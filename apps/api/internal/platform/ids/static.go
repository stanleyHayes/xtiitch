package ids

import "github.com/xcreativs/xtiitch/apps/api/internal/domain/common"

type StaticGenerator struct {
	Next common.ID
}

func (generator StaticGenerator) NewID() common.ID {
	return generator.Next
}
