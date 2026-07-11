package adminauth

import (
	"context"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type IssueSubscriptionInvoiceCommand struct {
	ActorUserID        common.ID
	ActorRole          admindomain.Role
	BusinessID         common.ID
	ProviderInvoiceRef string
	PaymentURL         string
	DueAt              *time.Time
	Reason             string
	UserAgent          string
	IPAddress          string
}

type MarkSubscriptionInvoicePaidCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	InvoiceID   common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

type MarkSubscriptionInvoiceFailedCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	InvoiceID   common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

func (s Service) IssueSubscriptionInvoice(
	ctx context.Context,
	cmd IssueSubscriptionInvoiceCommand,
) (ports.AdminSubscriptionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrForbidden
	}

	paymentURL, err := normalizePaymentURL(cmd.PaymentURL)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	invoiceID := s.ids.NewID()
	dueAt := subscriptionInvoiceDueAt(s.clock.Now(), cmd.DueAt)
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Subscription invoice issued."
	}

	record, err := s.businesses.IssueAdminSubscriptionInvoice(ctx, ports.IssueAdminSubscriptionInvoiceInput{
		InvoiceID:          invoiceID,
		BusinessID:         cmd.BusinessID,
		InvoiceRef:         subscriptionInvoiceRef(invoiceID),
		ProviderInvoiceRef: normalizeOperatorNote(cmd.ProviderInvoiceRef),
		PaymentURL:         paymentURL,
		DueAt:              dueAt,
		ActorAdminUser:     cmd.ActorUserID,
		Reason:             reason,
	})
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Issued subscription invoice",
		TargetType:  "business_subscription",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.BusinessName,
		Summary:     "Issued a subscription invoice for " + record.BusinessName + ".",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"business_id":          record.BusinessID.String(),
			"invoice_ref":          record.LastInvoiceRef,
			"provider_invoice_ref": normalizeOperatorNote(cmd.ProviderInvoiceRef),
			"payment_url":          paymentURL,
			"reason":               reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (s Service) MarkSubscriptionInvoicePaid(
	ctx context.Context,
	cmd MarkSubscriptionInvoicePaidCommand,
) (ports.AdminSubscriptionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.InvoiceID.IsZero() {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrForbidden
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Subscription invoice marked paid."
	}
	record, err := s.businesses.MarkAdminSubscriptionInvoicePaid(ctx, ports.MarkAdminSubscriptionInvoicePaidInput{
		InvoiceID:      cmd.InvoiceID,
		ActorAdminUser: cmd.ActorUserID,
		Reason:         reason,
	})
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Marked subscription invoice paid",
		TargetType:  "business_subscription",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.BusinessName,
		Summary:     "Marked subscription invoice paid for " + record.BusinessName + ".",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"business_id":  record.BusinessID.String(),
			"invoice_id":   cmd.InvoiceID.String(),
			"invoice_ref":  record.LastInvoiceRef,
			"billing_mode": record.BillingMode,
			"reason":       reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (s Service) MarkSubscriptionInvoiceFailed(
	ctx context.Context,
	cmd MarkSubscriptionInvoiceFailedCommand,
) (ports.AdminSubscriptionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.InvoiceID.IsZero() {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrForbidden
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Subscription invoice failed."
	}
	record, err := s.businesses.MarkAdminSubscriptionInvoiceFailed(ctx, ports.MarkAdminSubscriptionInvoiceFailedInput{
		InvoiceID:      cmd.InvoiceID,
		ActorAdminUser: cmd.ActorUserID,
		Reason:         reason,
	})
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Marked subscription invoice failed",
		TargetType:  "business_subscription",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.BusinessName,
		Summary:     "Marked subscription invoice failed for " + record.BusinessName + ".",
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"business_id":  record.BusinessID.String(),
			"invoice_id":   cmd.InvoiceID.String(),
			"invoice_ref":  record.LastInvoiceRef,
			"billing_mode": record.BillingMode,
			"reason":       reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}
func subscriptionInvoiceDueAt(now time.Time, value *time.Time) time.Time {
	if value == nil || value.IsZero() {
		return now.Add(7 * 24 * time.Hour)
	}
	return *value
}

func subscriptionInvoiceRef(invoiceID common.ID) string {
	compact := strings.ReplaceAll(invoiceID.String(), "-", "")
	if len(compact) > 12 {
		compact = compact[:12]
	}
	if compact == "" {
		compact = "manual"
	}
	return "XTSUB-" + strings.ToUpper(compact)
}
func normalizeProviderChargeStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "success", "successful":
		return "success"
	case "processing", "pending", "ongoing", "":
		return "pending"
	default:
		return "failed"
	}
}
func recurringChargeFailureReason(reason string) string {
	trimmed := normalizeOperatorNote(reason)
	if trimmed == "" {
		return "Paystack recurring charge failed."
	}
	const maxReasonLength = 220
	message := "Paystack recurring charge failed: " + trimmed
	if len([]rune(message)) > maxReasonLength {
		return string([]rune(message)[:maxReasonLength])
	}
	return message
}
