package authapp

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ---------------------------------------------------------------------------
// Opt-in TOTP MFA
// ---------------------------------------------------------------------------

// MFAStatus is the enrolment state for the current user.
type MFAStatus struct {
	Enabled         bool
	Enrolled        bool
	BackupCodesLeft int
}
type MFAEnrollmentSetup struct {
	Secret          string
	ProvisioningURI string
}

func (s Service) GetMFAStatus(ctx context.Context, scope common.TenantScope, userID common.ID) (MFAStatus, error) {
	if !s.mfaEnabled() {
		return MFAStatus{}, nil
	}
	enrollment, err := s.mfa.Get(ctx, scope, userID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return MFAStatus{}, nil
		}
		return MFAStatus{}, err
	}
	return MFAStatus{
		Enabled:         enrollment.Enabled,
		Enrolled:        true,
		BackupCodesLeft: enrollment.BackupCodesLeft,
	}, nil
}

func (s Service) StartMFAEnrollment(ctx context.Context, scope common.TenantScope, userID common.ID) (MFAEnrollmentSetup, error) {
	if !s.mfaEnabled() {
		return MFAEnrollmentSetup{}, authdomain.ErrForbidden
	}
	if scope.BusinessID.IsZero() || userID.IsZero() {
		return MFAEnrollmentSetup{}, authdomain.ErrInvalidInput
	}

	if existing, err := s.mfa.Get(ctx, scope, userID); err == nil && existing.Enabled {
		return MFAEnrollmentSetup{}, authdomain.ErrMFAAlreadyEnabled
	} else if err != nil && !errors.Is(err, ports.ErrNotFound) {
		return MFAEnrollmentSetup{}, err
	}

	secret, err := s.mfaSecrets.GenerateSecret()
	if err != nil {
		return MFAEnrollmentSetup{}, err
	}
	encrypted, err := s.mfaSecrets.EncryptSecret(secret)
	if err != nil {
		return MFAEnrollmentSetup{}, err
	}
	if err := s.mfa.Upsert(ctx, scope, ports.UpsertMFAInput{
		UserID:          userID,
		BusinessID:      scope.BusinessID,
		SecretEncrypted: encrypted,
	}); err != nil {
		return MFAEnrollmentSetup{}, err
	}

	return MFAEnrollmentSetup{
		Secret:          secret,
		ProvisioningURI: s.mfaSecrets.ProvisioningURI(secret, s.mfaAccountName(ctx, scope, userID)),
	}, nil
}

func (s Service) ActivateMFA(ctx context.Context, scope common.TenantScope, userID common.ID, code string) ([]string, error) {
	if !s.mfaEnabled() {
		return nil, authdomain.ErrForbidden
	}
	enrollment, err := s.mfa.Get(ctx, scope, userID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return nil, authdomain.ErrMFANotEnrolled
		}
		return nil, err
	}
	if enrollment.Enabled {
		return nil, authdomain.ErrMFAAlreadyEnabled
	}

	secret, err := s.mfaSecrets.DecryptSecret(enrollment.SecretEncrypted)
	if err != nil {
		return nil, err
	}
	step, ok := s.mfaSecrets.VerifyCode(secret, code, s.clock.Now(), enrollment.LastUsedStep)
	if !ok {
		return nil, authdomain.ErrInvalidMFACode
	}

	backupCodes, err := s.mfaSecrets.GenerateBackupCodes()
	if err != nil {
		return nil, err
	}
	hashes := make([]string, 0, len(backupCodes))
	for _, c := range backupCodes {
		hashes = append(hashes, s.mfaSecrets.HashBackupCode(c))
	}
	if err := s.mfa.Enable(ctx, scope, ports.EnableMFAInput{
		UserID:           userID,
		BackupCodeHashes: hashes,
		LastUsedStep:     step,
	}); err != nil {
		return nil, err
	}

	return backupCodes, nil
}

func (s Service) DisableMFA(ctx context.Context, scope common.TenantScope, userID common.ID, code string) error {
	if !s.mfaEnabled() {
		return authdomain.ErrForbidden
	}
	enrollment, err := s.mfa.Get(ctx, scope, userID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return authdomain.ErrMFANotEnabled
		}
		return err
	}
	if !enrollment.Enabled {
		return authdomain.ErrMFANotEnabled
	}

	ok, err := s.verifyMFAFactor(ctx, scope, enrollment, code)
	if err != nil {
		return err
	}
	if !ok {
		return authdomain.ErrInvalidMFACode
	}

	return s.mfa.Delete(ctx, scope, userID)
}

type VerifyMFALoginCommand struct {
	ChallengeToken string
	Code           string
	UserAgent      string
	IPAddress      string
}

func (s Service) VerifyMFALogin(ctx context.Context, cmd VerifyMFALoginCommand) (AuthResult, error) {
	if !s.mfaEnabled() {
		return AuthResult{}, authdomain.ErrForbidden
	}
	verified, err := s.mfaVerifier.VerifyMFAChallengeToken(ctx, strings.TrimSpace(cmd.ChallengeToken))
	if err != nil {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	scope := common.TenantScope{BusinessID: verified.BusinessID}
	enrollment, err := s.mfa.Get(ctx, scope, verified.Subject)
	if err != nil || !enrollment.Enabled {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	// Re-confirm the user is still active: they may have been deactivated during
	// the (up to 5-minute) challenge window.
	if !s.businessUserActive(ctx, scope, verified.Subject) {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	ok, err := s.verifyMFAFactor(ctx, scope, enrollment, cmd.Code)
	if err != nil {
		return AuthResult{}, err
	}
	if !ok {
		return AuthResult{}, authdomain.ErrInvalidMFACode
	}

	return s.issueSession(ctx, issueSessionInput{
		BusinessID:     verified.BusinessID,
		BusinessUserID: verified.Subject,
		Role:           verified.Role,
		UserAgent:      cmd.UserAgent,
		IPAddress:      cmd.IPAddress,
	})
}

func (s Service) verifyMFAFactor(ctx context.Context, scope common.TenantScope, enrollment ports.MFAEnrollment, code string) (bool, error) {
	now := s.clock.Now()
	if !enrollment.LockedUntil.IsZero() && now.Before(enrollment.LockedUntil) {
		// Locked out: refuse without consuming the code, surfaced as invalid.
		return false, nil
	}

	secret, err := s.mfaSecrets.DecryptSecret(enrollment.SecretEncrypted)
	if err != nil {
		return false, err
	}

	if step, ok := s.mfaSecrets.VerifyCode(secret, code, now, enrollment.LastUsedStep); ok {
		if err := s.mfa.MarkVerified(ctx, scope, enrollment.UserID, step); err != nil {
			return false, err
		}
		return true, nil
	}

	consumed, err := s.mfa.ConsumeBackupCode(ctx, scope, enrollment.UserID, s.mfaSecrets.HashBackupCode(code))
	if err != nil {
		return false, err
	}
	if consumed {
		// Reset the lockout counter (step is unchanged for backup codes).
		if err := s.mfa.MarkVerified(ctx, scope, enrollment.UserID, enrollment.LastUsedStep); err != nil {
			return false, err
		}
		return true, nil
	}

	if _, err := s.mfa.RegisterFailedAttempt(ctx, scope, enrollment.UserID, mfaMaxFailedAttempts, mfaLockoutDuration); err != nil {
		return false, err
	}
	return false, nil
}

func (s Service) businessUserActive(ctx context.Context, scope common.TenantScope, userID common.ID) bool {
	users, err := s.businesses.ListBusinessUsers(ctx, scope)
	if err != nil {
		return false
	}
	for _, u := range users {
		if u.UserID == userID {
			return u.IsActive
		}
	}
	return false
}

func (s Service) mfaAccountName(ctx context.Context, scope common.TenantScope, userID common.ID) string {
	users, err := s.businesses.ListBusinessUsers(ctx, scope)
	if err == nil {
		for _, u := range users {
			if u.UserID == userID && strings.TrimSpace(u.Email) != "" {
				return u.Email
			}
		}
	}
	return userID.String()
}
