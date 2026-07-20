package adminauth

import (
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type RunSubscriptionBillingSweepCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Reason      string
	UserAgent   string
	IPAddress   string
}

type RunSubscriptionRecurringSweepCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Reason      string
	UserAgent   string
	IPAddress   string
}

type RunSubscriptionReminderSweepCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Reason      string
	UserAgent   string
	IPAddress   string
}

type InitializeSubscriptionAuthorizationCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	BusinessID  common.ID
	CallbackURL string
	Reason      string
	UserAgent   string
	IPAddress   string
}

type SubscriptionAuthorizationLinkResult struct {
	BusinessID   common.ID
	BusinessName string
	OwnerEmail   string
	RedirectURL  string
	AccessCode   string
	Reference    string
}

type VerifySubscriptionAuthorizationCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	BusinessID  common.ID
	Reference   string
	Reason      string
	UserAgent   string
	IPAddress   string
}
