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

// SubmitIdentityVerificationCommand is a business's Ghana Card submission: the
// card number plus a photo of the FRONT and the BACK of the card.
type SubmitIdentityVerificationCommand struct {
	Scope          common.TenantScope
	ActorRole      business.UserRole
	CardNumber     string
	IDPhotoURL     string
	IDPhotoBackURL string
}

// SubmitIdentityVerification stores the tenant's Ghana Card number + front/back
// photos and moves them into verification 'pending' for operator review. The
// photos are uploaded to media storage by the caller; this records the URLs.
func (s Service) SubmitIdentityVerification(ctx context.Context, cmd SubmitIdentityVerificationCommand) error {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	// Normalize to the canonical Ghana Card PIN (GHA-#########-#) and validate the
	// format, so operators review a well-formed number rather than free text. Both
	// the front and the back photo are required.
	card := strings.ToUpper(strings.TrimSpace(cmd.CardNumber))
	front := strings.TrimSpace(cmd.IDPhotoURL)
	back := strings.TrimSpace(cmd.IDPhotoBackURL)
	if !ghanaCardPattern.MatchString(card) || !validPhotoURL(front) || !validPhotoURL(back) {
		return authdomain.ErrInvalidInput
	}
	return s.businesses.SubmitIdentityDocument(ctx, ports.SubmitIdentityDocumentInput{
		BusinessID:     cmd.Scope.BusinessID,
		CardNumber:     card,
		IDPhotoURL:     front,
		IDPhotoBackURL: back,
	})
}

// validPhotoURL accepts a non-empty http(s) media URL within a sane length.
func validPhotoURL(u string) bool {
	if u == "" || len(u) > 2048 {
		return false
	}
	return strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://")
}

// ghanaCardPattern matches the Ghana Card personal id number: GHA-#########-#.
var ghanaCardPattern = regexp.MustCompile(`^GHA-[0-9]{9}-[0-9]$`)
