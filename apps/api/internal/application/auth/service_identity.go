package authapp

import (
	"context"
	"regexp"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// SubmitIdentityVerificationCommand is a business's Ghana Card submission.
type SubmitIdentityVerificationCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	CardNumber string
	IDPhotoURL string
}

// SubmitIdentityVerification stores the tenant's Ghana Card number + ID photo and
// moves them into verification 'pending' for operator review. The photo is
// uploaded to media storage by the caller; this records the resulting URL.
func (s Service) SubmitIdentityVerification(ctx context.Context, cmd SubmitIdentityVerificationCommand) error {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	// Normalize to the canonical Ghana Card PIN (GHA-#########-#) and validate the
	// format, so operators review a well-formed number rather than free text.
	card := strings.ToUpper(strings.TrimSpace(cmd.CardNumber))
	photo := strings.TrimSpace(cmd.IDPhotoURL)
	if !ghanaCardPattern.MatchString(card) || photo == "" || len(photo) > 2048 {
		return authdomain.ErrInvalidInput
	}
	if !strings.HasPrefix(photo, "http://") && !strings.HasPrefix(photo, "https://") {
		return authdomain.ErrInvalidInput
	}
	return s.businesses.SubmitIdentityDocument(ctx, ports.SubmitIdentityDocumentInput{
		BusinessID: cmd.Scope.BusinessID,
		CardNumber: card,
		IDPhotoURL: photo,
	})
}

// ghanaCardPattern matches the Ghana Card personal id number: GHA-#########-#.
var ghanaCardPattern = regexp.MustCompile(`^GHA-[0-9]{9}-[0-9]$`)
