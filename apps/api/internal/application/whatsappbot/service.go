// Package whatsappbot is the inbound WhatsApp ordering bot's conversation
// engine. Phase 1 is a read-only assistant that works on every plan: resolve a
// shop by handle, browse its designs (price + sizes), and track an order by code
// — all in chat, no app, no login. Paid in-chat ordering + payment links arrive
// in Phase 2 (gated by the same online_ordering benefit as storefront checkout).
package whatsappbot

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

const (
	// sessionTTL is how long a conversation stays live between messages.
	sessionTTL = 30 * time.Minute
	// optOutKeyword ends a conversation and stops auto-replies (WA etiquette).
	optOutKeyword = "STOP"
	// maxBrowseDesigns caps the in-chat design list so a long catalogue stays
	// readable on a phone.
	maxBrowseDesigns = 10
)

// Conversation steps persisted in the session state.
const (
	stepAwaitingShop  = "awaiting_shop"
	stepMenu          = "menu"
	stepBrowsing      = "browsing"
	stepAwaitingOrder = "awaiting_order"
	stepOrderSize     = "order_size"
	stepOrderName     = "order_name"
)

type Service struct {
	sessions       ports.WhatsAppSessionRepository
	dedupe         ports.WhatsAppDedupeStore
	sender         ports.WhatsAppSender
	catalogue      ports.BotCatalogue
	clock          ports.Clock
	storefrontBase string
}

type Dependencies struct {
	Sessions       ports.WhatsAppSessionRepository
	Dedupe         ports.WhatsAppDedupeStore
	Sender         ports.WhatsAppSender
	Catalogue      ports.BotCatalogue
	Clock          ports.Clock
	StorefrontBase string
}

func NewService(deps Dependencies) Service {
	base := strings.TrimRight(deps.StorefrontBase, "/")
	if base == "" {
		base = "https://xtiitch.com"
	}
	return Service{
		sessions:       deps.Sessions,
		dedupe:         deps.Dedupe,
		sender:         deps.Sender,
		catalogue:      deps.Catalogue,
		clock:          deps.Clock,
		storefrontBase: base,
	}
}

// InboundMessage is one normalized message lifted from a Meta webhook payload.
type InboundMessage struct {
	WaID        string // sender's WhatsApp id (their phone, e.g. 233244000111)
	MessageID   string // Meta message id (wamid...), used for dedupe
	Type        string // "text", "interactive", ...
	Text        string // text body or interactive reply title
	ContactName string // sender's WhatsApp profile name, if provided
}

// conversationState is the opaque per-sender state persisted as JSON.
type conversationState struct {
	Step           string         `json:"step"`
	Shop           string         `json:"shop,omitempty"`
	ShopName       string         `json:"shop_name,omitempty"`
	OnlineOrdering bool           `json:"online_ordering,omitempty"`
	Listing        []listedDesign `json:"listing,omitempty"`
	// Order-in-progress (Phase 2). Held across the size → name → pay steps.
	OrderDesign  string      `json:"order_design,omitempty"`
	OrderTitle   string      `json:"order_title,omitempty"`
	OrderSizes   []orderSize `json:"order_sizes,omitempty"`
	ChosenBandID string      `json:"chosen_band,omitempty"`
	ChosenLabel  string      `json:"chosen_label,omitempty"`
	ChosenAmount int64       `json:"chosen_amount,omitempty"`
	Turns        int         `json:"turns"`
}

type listedDesign struct {
	Title  string `json:"t"`
	Handle string `json:"h"`
}

type orderSize struct {
	BandID     string `json:"b"`
	Label      string `json:"l"`
	PriceMinor int64  `json:"p"`
}

// outcome is what one turn produces: the reply, the next state, the resolved
// business id, and whether to clear the session.
type outcome struct {
	reply      string
	state      conversationState
	businessID string
	clear      bool
}

// HandleInbound advances one inbound message: dedupe, load/seed the session,
// run the state machine, persist, and send. It is the single entry point the
// webhook calls per message. Returns nil for ignored (duplicate/empty) messages.
func (s Service) HandleInbound(ctx context.Context, msg InboundMessage) error {
	if strings.TrimSpace(msg.WaID) == "" {
		return nil
	}
	if msg.MessageID != "" {
		seen, err := s.dedupe.MarkProcessed(ctx, msg.MessageID)
		if err != nil {
			return err
		}
		if seen {
			return nil // Meta retried a message we already handled.
		}
	}

	if strings.EqualFold(strings.TrimSpace(msg.Text), optOutKeyword) {
		if err := s.sessions.DeleteSession(ctx, msg.WaID); err != nil {
			return err
		}
		return s.sender.SendText(ctx, msg.WaID, "You're opted out and won't get more messages. Send any message to start again.")
	}

	session, existed, err := s.sessions.GetSession(ctx, msg.WaID)
	if err != nil {
		return err
	}
	state := decodeState(session.State)
	state.Turns++

	result, err := s.advance(ctx, existed, session.BusinessID, state, msg)
	if err != nil {
		return err
	}
	if err := s.persist(ctx, msg.WaID, result); err != nil {
		return err
	}
	return s.sender.SendText(ctx, msg.WaID, result.reply)
}

// persist writes the turn's resulting session (or clears it).
func (s Service) persist(ctx context.Context, waID string, result outcome) error {
	if result.clear {
		return s.sessions.DeleteSession(ctx, waID)
	}
	encoded, err := json.Marshal(result.state)
	if err != nil {
		return err
	}
	return s.sessions.SaveSession(ctx, ports.WhatsAppSession{
		WaID:       waID,
		BusinessID: result.businessID,
		State:      encoded,
		ExpiresAt:  s.now().Add(sessionTTL),
	})
}

// advance is the state machine: it routes by the current step. A brand-new
// conversation (or one with no step) is greeted and asked for a shop.
func (s Service) advance(ctx context.Context, existed bool, businessID string, state conversationState, msg InboundMessage) (outcome, error) {
	if !existed || state.Step == "" {
		return outcome{reply: greeting(msg.ContactName), state: withStep(state, stepAwaitingShop)}, nil
	}
	switch state.Step {
	case stepAwaitingShop:
		return s.handleShopInput(ctx, state, msg.Text)
	case stepMenu:
		return s.handleMenu(ctx, businessID, state, msg.Text)
	case stepBrowsing:
		return s.handleBrowsing(ctx, businessID, state, msg.Text)
	case stepAwaitingOrder:
		return s.handleOrderCode(ctx, businessID, state, msg.Text)
	case stepOrderSize:
		return s.handleOrderSize(ctx, businessID, state, msg.Text)
	case stepOrderName:
		return s.handleOrderName(ctx, businessID, state, msg.WaID, msg.Text)
	default:
		return outcome{reply: greeting(msg.ContactName), state: withStep(state, stepAwaitingShop)}, nil
	}
}

// handleShopInput resolves the shop the customer named and opens the menu.
func (s Service) handleShopInput(ctx context.Context, state conversationState, text string) (outcome, error) {
	handle := normalizeHandle(text)
	if handle == "" {
		return outcome{reply: "Which shop would you like to browse? Reply with the shop name.", state: withStep(state, stepAwaitingShop)}, nil
	}
	shop, err := s.catalogue.ResolveShop(ctx, handle)
	if errors.Is(err, ports.ErrNotFound) {
		return outcome{
			reply: fmt.Sprintf("I couldn't find a shop called %q. Check the spelling and try the shop's exact name, e.g. demo-atelier.", text),
			state: withStep(state, stepAwaitingShop),
		}, nil
	}
	if err != nil {
		return outcome{}, err
	}
	next := state
	next.Step = stepMenu
	next.Shop = shop.Handle
	next.ShopName = shop.Name
	next.OnlineOrdering = shop.OnlineOrdering
	return outcome{reply: s.shopMenu(shop.Name), state: next, businessID: shop.BusinessID}, nil
}

// handleMenu parses the top-level commands: browse, track, switch shop.
func (s Service) handleMenu(ctx context.Context, businessID string, state conversationState, text string) (outcome, error) {
	command := strings.ToLower(strings.TrimSpace(text))
	switch {
	case command == "browse" || command == "1" || command == "designs":
		return s.listDesigns(ctx, businessID, state)
	case command == "track" || command == "2":
		return outcome{reply: "Sure — send me your order code (it's in your order confirmation message).", state: withStep(state, stepAwaitingOrder), businessID: businessID}, nil
	case strings.HasPrefix(command, "track "):
		return s.trackOrder(ctx, businessID, state, strings.TrimSpace(text[len("track "):]))
	case strings.HasPrefix(command, "shop "):
		return s.handleShopInput(ctx, state, strings.TrimSpace(text[len("shop "):]))
	case command == "order" || command == "buy":
		return s.startOrder(ctx, businessID, state)
	case command == "menu" || command == "help" || command == "hi" || command == "hello":
		return outcome{reply: s.shopMenu(state.ShopName), state: state, businessID: businessID}, nil
	default:
		return outcome{reply: "Sorry, I didn't catch that. Reply *BROWSE* to see designs, or *TRACK <order code>* to check an order.", state: state, businessID: businessID}, nil
	}
}

// listDesigns shows a numbered, paged list of the shop's active designs.
func (s Service) listDesigns(ctx context.Context, businessID string, state conversationState) (outcome, error) {
	designs, err := s.catalogue.ListDesigns(ctx, businessID)
	if err != nil {
		return outcome{}, err
	}
	if len(designs) == 0 {
		return outcome{reply: "This shop hasn't published any designs yet — check back soon! Reply *MENU* anytime.", state: withStep(state, stepMenu), businessID: businessID}, nil
	}

	var b strings.Builder
	fmt.Fprintf(&b, "Here's what %s has 👗\n\n", state.ShopName)
	listing := make([]listedDesign, 0, maxBrowseDesigns)
	for i, d := range designs {
		if i >= maxBrowseDesigns {
			break
		}
		fmt.Fprintf(&b, "%d. %s — from %s\n", i+1, d.Title, formatGHS(d.FromPriceMinor))
		listing = append(listing, listedDesign{Title: d.Title, Handle: d.Handle})
	}
	if len(designs) > maxBrowseDesigns {
		fmt.Fprintf(&b, "\n(+%d more on your shop page)", len(designs)-maxBrowseDesigns)
	}
	b.WriteString("\n\nReply with a number to see sizes & prices, or *MENU* to go back.")

	next := state
	next.Step = stepBrowsing
	next.Listing = listing
	return outcome{reply: b.String(), state: next, businessID: businessID}, nil
}

// handleBrowsing reacts to a design number pick (or menu/browse navigation).
func (s Service) handleBrowsing(ctx context.Context, businessID string, state conversationState, text string) (outcome, error) {
	command := strings.ToLower(strings.TrimSpace(text))
	if command == "menu" || command == "back" {
		return outcome{reply: s.shopMenu(state.ShopName), state: withStep(state, stepMenu), businessID: businessID}, nil
	}
	if command == "browse" {
		return s.listDesigns(ctx, businessID, state)
	}
	if n, err := strconv.Atoi(command); err == nil && n >= 1 && n <= len(state.Listing) {
		return s.designDetail(ctx, businessID, state, state.Listing[n-1].Handle)
	}
	return outcome{reply: "Reply with a design number from the list, or *MENU* to go back.", state: state, businessID: businessID}, nil
}

// designDetail shows one design's sizes + from-price and a link to order.
func (s Service) designDetail(ctx context.Context, businessID string, state conversationState, handle string) (outcome, error) {
	designs, err := s.catalogue.ListDesigns(ctx, businessID)
	if err != nil {
		return outcome{}, err
	}
	for _, d := range designs {
		if d.Handle != handle {
			continue
		}
		var b strings.Builder
		fmt.Fprintf(&b, "*%s*\nFrom %s\n", d.Title, formatGHS(d.FromPriceMinor))
		if labels := sizeLabels(d.Sizes); labels != "" {
			fmt.Fprintf(&b, "Sizes: %s\n", labels)
		}
		next := state
		next.Step = stepMenu
		next.OrderDesign = d.Handle
		next.OrderTitle = d.Title
		if state.OnlineOrdering && len(d.Sizes) > 0 {
			b.WriteString("\n🛒 Reply *ORDER* to buy this one, or *MENU* to keep browsing.")
		} else {
			fmt.Fprintf(&b, "\nTo order, open %s/%s. Reply *MENU* to keep browsing.", s.storefrontBase, state.Shop)
		}
		return outcome{reply: b.String(), state: next, businessID: businessID}, nil
	}
	// The design vanished between listing and selection; re-list.
	return s.listDesigns(ctx, businessID, state)
}

// startOrder begins in-chat ordering for the design last viewed: it lists the
// size bands and moves to the size-pick step. Refused when the shop's plan lacks
// online ordering.
func (s Service) startOrder(ctx context.Context, businessID string, state conversationState) (outcome, error) {
	if !state.OnlineOrdering {
		return outcome{reply: fmt.Sprintf("This shop isn't taking online orders in chat yet. You can still order at %s/%s. Reply *MENU* for more.", s.storefrontBase, state.Shop), state: withStep(state, stepMenu), businessID: businessID}, nil
	}
	if state.OrderDesign == "" {
		return outcome{reply: "Pick a design first: reply *BROWSE*, choose a number, then *ORDER*.", state: withStep(state, stepMenu), businessID: businessID}, nil
	}
	designs, err := s.catalogue.ListDesigns(ctx, businessID)
	if err != nil {
		return outcome{}, err
	}
	for _, d := range designs {
		if d.Handle != state.OrderDesign || len(d.Sizes) == 0 {
			continue
		}
		var b strings.Builder
		fmt.Fprintf(&b, "Ordering *%s* 🛒\nWhich size? Reply with a number:\n", d.Title)
		sizes := make([]orderSize, 0, len(d.Sizes))
		for i, band := range d.Sizes {
			fmt.Fprintf(&b, "%d. %s — %s\n", i+1, band.Label, formatGHS(band.PriceMinor))
			sizes = append(sizes, orderSize{BandID: band.ID, Label: band.Label, PriceMinor: band.PriceMinor})
		}
		b.WriteString("\nOr reply *MENU* to cancel.")
		next := state
		next.Step = stepOrderSize
		next.OrderTitle = d.Title
		next.OrderSizes = sizes
		return outcome{reply: b.String(), state: next, businessID: businessID}, nil
	}
	return outcome{reply: "That design isn't available to order right now. Reply *MENU* for more.", state: withStep(state, stepMenu), businessID: businessID}, nil
}

// handleOrderSize records the chosen size band and asks for the customer's name.
func (s Service) handleOrderSize(_ context.Context, businessID string, state conversationState, text string) (outcome, error) {
	command := strings.ToLower(strings.TrimSpace(text))
	if command == "menu" || command == "cancel" {
		return outcome{reply: s.shopMenu(state.ShopName), state: clearOrder(withStep(state, stepMenu)), businessID: businessID}, nil
	}
	n, err := strconv.Atoi(command)
	if err != nil || n < 1 || n > len(state.OrderSizes) {
		return outcome{reply: "Reply with a size number from the list, or *MENU* to cancel.", state: state, businessID: businessID}, nil
	}
	band := state.OrderSizes[n-1]
	next := state
	next.Step = stepOrderName
	next.ChosenBandID = band.BandID
	next.ChosenLabel = band.Label
	next.ChosenAmount = band.PriceMinor
	reply := fmt.Sprintf("Great — *%s* (%s), size %s.\nWhat name should we put on the order?", state.OrderTitle, formatGHS(band.PriceMinor), band.Label)
	return outcome{reply: reply, state: next, businessID: businessID}, nil
}

// handleOrderName captures the name, places the order via checkout, and sends the
// Paystack payment link. The existing webhook confirms the order on payment and
// auto-sends the WhatsApp confirmation, so the bot's job ends at the link.
func (s Service) handleOrderName(ctx context.Context, businessID string, state conversationState, waID, text string) (outcome, error) {
	name := strings.TrimSpace(text)
	if strings.EqualFold(name, "menu") || strings.EqualFold(name, "cancel") {
		return outcome{reply: s.shopMenu(state.ShopName), state: clearOrder(withStep(state, stepMenu)), businessID: businessID}, nil
	}
	if name == "" {
		return outcome{reply: "Please reply with the name for the order, or *MENU* to cancel.", state: state, businessID: businessID}, nil
	}

	draft, err := s.catalogue.PlaceStandardOrder(ctx, ports.BotOrderRequest{
		StoreHandle:   state.Shop,
		DesignHandle:  state.OrderDesign,
		SizeBandID:    state.ChosenBandID,
		CustomerName:  name,
		CustomerPhone: waID,
		CustomerEmail: synthEmail(waID),
	})
	if errors.Is(err, ports.ErrOrderingUnavailable) {
		return outcome{reply: "This shop isn't taking online orders right now. Reply *MENU* for more.", state: clearOrder(withStep(state, stepMenu)), businessID: businessID}, nil
	}
	if err != nil {
		return outcome{reply: "Sorry, I couldn't start that order just now. Please try again in a moment, or reply *MENU*.", state: clearOrder(withStep(state, stepMenu)), businessID: businessID}, nil
	}

	reply := fmt.Sprintf(
		"🧾 Order ready: *%s* (size %s) — %s.\n\nTap to pay securely:\n%s\n\nOnce your payment is confirmed you'll get a confirmation here. Reply *MENU* for more.",
		state.OrderTitle, state.ChosenLabel, formatGHS(draft.AmountMinor), draft.AuthorizationURL,
	)
	return outcome{reply: reply, state: clearOrder(withStep(state, stepMenu)), businessID: businessID}, nil
}

// clearOrder wipes the in-progress order fields once an order is placed/cancelled.
func clearOrder(state conversationState) conversationState {
	state.OrderDesign = ""
	state.OrderTitle = ""
	state.OrderSizes = nil
	state.ChosenBandID = ""
	state.ChosenLabel = ""
	state.ChosenAmount = 0
	return state
}

// synthEmail builds a placeholder email from the WhatsApp number; Paystack
// requires one and chat customers rarely have/share email. They get the order
// confirmation on WhatsApp, not by email.
func synthEmail(waID string) string {
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, waID)
	if digits == "" {
		digits = "guest"
	}
	return "wa" + digits + "@whatsapp.xtiitch.com"
}

// handleOrderCode looks up an order by its tracking code.
func (s Service) handleOrderCode(ctx context.Context, businessID string, state conversationState, text string) (outcome, error) {
	return s.trackOrder(ctx, businessID, state, strings.TrimSpace(text))
}

func (s Service) trackOrder(ctx context.Context, businessID string, state conversationState, code string) (outcome, error) {
	if code == "" {
		return outcome{reply: "Send me your order code to track it.", state: withStep(state, stepAwaitingOrder), businessID: businessID}, nil
	}
	o, err := s.catalogue.TrackOrder(ctx, code)
	if errors.Is(err, ports.ErrNotFound) {
		return outcome{reply: "I couldn't find an order with that code. Double-check it and try again, or reply *MENU*.", state: withStep(state, stepAwaitingOrder), businessID: businessID}, nil
	}
	if err != nil {
		return outcome{}, err
	}
	reply := fmt.Sprintf("%s Your order *%s* at %s\nStatus: %s", stageEmoji(o.Colour), o.DesignTitle, o.StoreName, humanizeStatus(o.Status))
	if o.Stage != "" {
		reply += fmt.Sprintf("\nStage: %s", o.Stage)
	}
	reply += "\n\nReply *MENU* for more."
	return outcome{reply: reply, state: withStep(state, stepMenu), businessID: businessID}, nil
}

func (s Service) shopMenu(name string) string {
	return fmt.Sprintf("You're shopping *%s* 🛍️\n\nReply *BROWSE* to see designs, or *TRACK <order code>* to check an order. Send *STOP* to opt out.", name)
}

func greeting(name string) string {
	who := strings.TrimSpace(name)
	if who == "" {
		who = "there"
	}
	return fmt.Sprintf("Hi %s! 👋 Welcome to Xtiitch shopping. Which shop would you like to browse? Reply with the shop name (for example: demo-atelier).", who)
}

func withStep(state conversationState, step string) conversationState {
	state.Step = step
	return state
}

func decodeState(raw []byte) conversationState {
	var state conversationState
	if len(raw) == 0 {
		return state
	}
	_ = json.Unmarshal(raw, &state)
	return state
}

// sizeLabels joins a design's size-band labels for display ("S, M, L").
func sizeLabels(bands []ports.BotSizeBand) string {
	labels := make([]string, 0, len(bands))
	for _, b := range bands {
		if b.Label != "" {
			labels = append(labels, b.Label)
		}
	}
	return strings.Join(labels, ", ")
}

// normalizeHandle turns "Demo Atelier" or "demo atelier" into "demo-atelier".
func normalizeHandle(text string) string {
	trimmed := strings.ToLower(strings.TrimSpace(text))
	return strings.Join(strings.Fields(trimmed), "-")
}

// formatGHS renders minor units (pesewas) as cedis, dropping ".00".
func formatGHS(minor int64) string {
	if minor%100 == 0 {
		return fmt.Sprintf("GHS %d", minor/100)
	}
	return fmt.Sprintf("GHS %.2f", float64(minor)/100)
}

func stageEmoji(colour string) string {
	switch colour {
	case "green":
		return "✅"
	case "yellow":
		return "🟡"
	case "red":
		return "🔴"
	default:
		return "📦"
	}
}

func humanizeStatus(status string) string {
	return strings.ReplaceAll(status, "_", " ")
}

func (s Service) now() time.Time {
	if s.clock != nil {
		return s.clock.Now()
	}
	return time.Now()
}
