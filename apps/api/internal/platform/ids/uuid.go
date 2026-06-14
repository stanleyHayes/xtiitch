package ids

import (
	"github.com/google/uuid"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type UUIDGenerator struct{}

func (UUIDGenerator) NewID() common.ID {
	return common.ID(uuid.NewString())
}
