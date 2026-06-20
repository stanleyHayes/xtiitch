package ports

import "context"

// AssistInput is a single AI writing-assist request: the user's draft text, the
// kind of help they want (improve/rewrite/shorten/expand/friendly/fix), and an
// optional hint about what the field is (e.g. "design description").
type AssistInput struct {
	Text        string
	Instruction string
	Field       string
}

// AiAssistant rewrites/improves short business copy. Implementations must be
// safe to call with any input and should degrade to returning the input text
// unchanged rather than erroring when the upstream model is unavailable.
type AiAssistant interface {
	Assist(ctx context.Context, input AssistInput) (string, error)
}
