package authapp

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type ListBusinessUsersCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
}

func (s Service) ListBusinessUsers(ctx context.Context, cmd ListBusinessUsersCommand) ([]ports.BusinessUserRecord, error) {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return nil, err
	}

	return s.businesses.ListBusinessUsers(ctx, cmd.Scope)
}

type CreateBusinessUserCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	DisplayName string
	Phone       string
	Email       string
	Password    string
	Role        business.UserRole
}

func (s Service) CreateBusinessUser(ctx context.Context, cmd CreateBusinessUserCommand) (ports.BusinessUserRecord, error) {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return ports.BusinessUserRecord{}, err
	}

	normalized, err := normalizeBusinessUserCreation(cmd)
	if err != nil {
		return ports.BusinessUserRecord{}, err
	}

	passwordHash, err := s.passwords.Hash(normalized.Password)
	if err != nil {
		return ports.BusinessUserRecord{}, err
	}

	user, err := s.businesses.CreateBusinessUser(ctx, cmd.Scope, ports.CreateBusinessUserInput{
		UserID:       s.ids.NewID(),
		BusinessID:   cmd.Scope.BusinessID,
		Email:        normalized.Email,
		DisplayName:  normalized.DisplayName,
		Phone:        strings.TrimSpace(cmd.Phone),
		PasswordHash: passwordHash,
		Role:         normalized.Role,
	})
	if err != nil {
		return ports.BusinessUserRecord{}, err
	}
	// Best-effort invite email: never fail user creation on a delivery hiccup, but
	// log it so a missing invite is visible rather than silently dropped.
	if inviteErr := s.sendBusinessUserInvite(ctx, user); inviteErr != nil {
		s.logger.Warn("business user invite email failed",
			slog.String("business_id", cmd.Scope.BusinessID.String()),
			slog.String("error", inviteErr.Error()))
	}
	return user, nil
}

type UpdateBusinessUserCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	UserID      common.ID
	DisplayName string
	Phone       string
	Role        business.UserRole
	IsActive    bool
}

func (s Service) UpdateBusinessUser(ctx context.Context, cmd UpdateBusinessUserCommand) (ports.BusinessUserRecord, error) {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return ports.BusinessUserRecord{}, err
	}
	if cmd.UserID.IsZero() {
		return ports.BusinessUserRecord{}, authdomain.ErrInvalidInput
	}

	displayName := strings.TrimSpace(cmd.DisplayName)
	if displayName == "" || !isManageableBusinessUserRole(cmd.Role) {
		return ports.BusinessUserRecord{}, authdomain.ErrInvalidInput
	}

	return s.businesses.UpdateBusinessUser(ctx, cmd.Scope, ports.UpdateBusinessUserInput{
		UserID:      cmd.UserID,
		DisplayName: displayName,
		Phone:       strings.TrimSpace(cmd.Phone),
		Role:        cmd.Role,
		IsActive:    cmd.IsActive,
	})
}

type ResetBusinessUserPasswordCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	UserID      common.ID
	NewPassword string
}

func (s Service) ResetBusinessUserPassword(ctx context.Context, cmd ResetBusinessUserPasswordCommand) error {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.UserID.IsZero() || len(cmd.NewPassword) < minPasswordLength || len(cmd.NewPassword) > maxPasswordLength {
		return authdomain.ErrInvalidInput
	}

	passwordHash, err := s.passwords.Hash(cmd.NewPassword)
	if err != nil {
		return err
	}

	return s.businesses.UpdateBusinessUserPassword(ctx, cmd.Scope, ports.UpdateBusinessUserPasswordInput{
		UserID:       cmd.UserID,
		PasswordHash: passwordHash,
	})
}

// ChangeOwnPasswordCommand carries a self-service password change for the
// authenticated user: they prove knowledge of CurrentPassword and set NewPassword.
type ChangeOwnPasswordCommand struct {
	Scope           common.TenantScope
	UserID          common.ID
	CurrentPassword string
	NewPassword     string
}

// ChangeOwnPassword lets a signed-in business user (owner or staff) rotate their
// own password by confirming the current one first. Unlike the admin reset path,
// it works for the owner too, since it is scoped to the caller's own user id.
func (s Service) ChangeOwnPassword(ctx context.Context, cmd ChangeOwnPasswordCommand) error {
	if cmd.UserID.IsZero() {
		return authdomain.ErrInvalidInput
	}
	if len(cmd.NewPassword) < minPasswordLength || len(cmd.NewPassword) > maxPasswordLength {
		return authdomain.ErrInvalidInput
	}

	credentials, err := s.businesses.FindBusinessUserCredentialsByID(ctx, cmd.Scope, cmd.UserID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return authdomain.ErrInvalidCredentials
		}
		return err
	}
	if !credentials.IsActive {
		return authdomain.ErrInvalidCredentials
	}
	// Confirm the current password before allowing a change. A mismatch is an
	// invalid-credentials failure, distinct from a missing/expired session.
	if err := s.passwords.Compare(credentials.PasswordHash, cmd.CurrentPassword); err != nil {
		return authdomain.ErrInvalidCredentials
	}

	passwordHash, err := s.passwords.Hash(cmd.NewPassword)
	if err != nil {
		return err
	}

	return s.businesses.UpdateOwnPassword(ctx, cmd.Scope, ports.UpdateBusinessUserPasswordInput{
		UserID:       cmd.UserID,
		PasswordHash: passwordHash,
	})
}

type TransferBusinessOwnerCommand struct {
	Scope          common.TenantScope
	ActorUserID    common.ID
	ActorRole      business.UserRole
	NewOwnerUserID common.ID
	Confirmation   string
}

func (s Service) TransferBusinessOwner(ctx context.Context, cmd TransferBusinessOwnerCommand) (ports.TransferBusinessOwnerResult, error) {
	if cmd.Scope.BusinessID.IsZero() || cmd.ActorUserID.IsZero() || cmd.NewOwnerUserID.IsZero() {
		return ports.TransferBusinessOwnerResult{}, authdomain.ErrInvalidInput
	}
	if cmd.ActorRole != business.UserRoleOwner {
		return ports.TransferBusinessOwnerResult{}, authdomain.ErrForbidden
	}
	if cmd.ActorUserID == cmd.NewOwnerUserID {
		return ports.TransferBusinessOwnerResult{}, authdomain.ErrInvalidInput
	}
	if strings.TrimSpace(cmd.Confirmation) != ownerTransferConfirmation {
		return ports.TransferBusinessOwnerResult{}, authdomain.ErrInvalidInput
	}

	return s.businesses.TransferBusinessOwner(ctx, cmd.Scope, ports.TransferBusinessOwnerInput{
		CurrentOwnerUserID: cmd.ActorUserID,
		NewOwnerUserID:     cmd.NewOwnerUserID,
	})
}

type normalizedBusinessUserCreation struct {
	DisplayName string
	Email       string
	Password    string
	Role        business.UserRole
}

func normalizeBusinessUserCreation(cmd CreateBusinessUserCommand) (normalizedBusinessUserCreation, error) {
	displayName := strings.TrimSpace(cmd.DisplayName)
	email, err := normalizeEmail(cmd.Email)
	if err != nil {
		return normalizedBusinessUserCreation{}, errors.Join(authdomain.ErrInvalidInput, err)
	}
	if displayName == "" || !isManageableBusinessUserRole(cmd.Role) {
		return normalizedBusinessUserCreation{}, authdomain.ErrInvalidInput
	}
	if len(cmd.Password) < minPasswordLength || len(cmd.Password) > maxPasswordLength {
		return normalizedBusinessUserCreation{}, authdomain.ErrInvalidInput
	}

	return normalizedBusinessUserCreation{
		DisplayName: displayName,
		Email:       email,
		Password:    cmd.Password,
		Role:        cmd.Role,
	}, nil
}
func authorizeBusinessUserManagement(scope common.TenantScope, role business.UserRole) error {
	if scope.BusinessID.IsZero() {
		return authdomain.ErrInvalidInput
	}
	switch role {
	case business.UserRoleOwner, business.UserRoleAdmin:
		return nil
	default:
		return authdomain.ErrForbidden
	}
}
func isManageableBusinessUserRole(role business.UserRole) bool {
	return role == business.UserRoleAdmin || role == business.UserRoleStaff
}
func (s Service) sendBusinessUserInvite(ctx context.Context, user ports.BusinessUserRecord) error {
	if s.emails == nil || strings.TrimSpace(user.Email) == "" {
		return nil
	}
	loginURL := s.dashboardURL
	if loginURL == "" {
		loginURL = "https://app.xtiitch.com"
	}
	loginURL = strings.TrimRight(loginURL, "/") + "/login"
	displayName := strings.TrimSpace(user.DisplayName)
	if displayName == "" {
		displayName = user.Email
	}
	subject := "You have been invited to Xtiitch"
	body := fmt.Sprintf(
		"Hi %s,\n\nYou have been added to the Xtiitch business dashboard as %s.\nOpen %s and sign in with this email address. For security, Xtiitch does not email temporary passwords, so ask your owner or admin for the temporary password they set for you.\n\nThanks,\nXtiitch",
		displayName,
		user.Role,
		loginURL,
	)
	return s.emails.Send(ctx, ports.EmailMessage{
		To:      user.Email,
		Subject: subject,
		Body:    body,
	})
}
