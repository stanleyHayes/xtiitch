package customer

import "github.com/xcreativs/xtiitch/apps/api/internal/domain/common"

type Customer struct {
	ID          common.ID
	Email       string
	DisplayName string
	// Phone is the OTP-verified login number (SMS).
	Phone string
	// WhatsAppPhone is a separate contact number the customer can set so the store
	// can reach them on WhatsApp; distinct from the verified login Phone.
	WhatsAppPhone string
}
