package customer

import "github.com/xcreativs/xtiitch/apps/api/internal/domain/common"

type Customer struct {
	ID          common.ID
	Email       string
	DisplayName string
	Phone       string
}
