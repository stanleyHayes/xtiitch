package authadapter

import (
	"strings"
	"testing"
	"time"
)

func TestTOTPGenerateAndVerify(t *testing.T) {
	t.Parallel()
	m := NewTOTPManager("Xtiitch", "test-key-material")

	secret, err := m.GenerateSecret()
	if err != nil {
		t.Fatalf("generate secret: %v", err)
	}

	now := time.Unix(1_700_000_000, 0)

	// We cannot know the code without recomputing it, so verify the manager
	// agrees with its own HOTP for the current step.
	key, err := base32NoPad.DecodeString(secret)
	if err != nil {
		t.Fatalf("decode secret: %v", err)
	}
	step := int64(uint64(now.Unix()) / m.period) //nolint:gosec // Unix timestamp is non-negative and m.period is a small positive constant
	code := m.hotp(key, uint64(step))            //nolint:gosec // step is non-negative in tests

	matchedStep, ok := m.VerifyCode(secret, code, now, 0)
	if !ok {
		t.Fatalf("expected current code to verify")
	}
	if matchedStep != step {
		t.Fatalf("expected matched step %d, got %d", step, matchedStep)
	}
	// Replay guard: once the step is consumed (afterStep = step), the same code
	// must be rejected.
	if _, ok := m.VerifyCode(secret, code, now, step); ok {
		t.Fatalf("expected replayed code to be rejected by the step guard")
	}
	// A far-off time must not verify the same code.
	if _, ok := m.VerifyCode(secret, code, now.Add(10*time.Minute), 0); ok {
		t.Fatalf("expected stale code to fail")
	}
	if _, ok := m.VerifyCode(secret, "000000", now, 0); ok && code != "000000" {
		t.Fatalf("expected wrong code to fail")
	}
}

func TestTOTPSecretEncryptionRoundTrip(t *testing.T) {
	t.Parallel()
	m := NewTOTPManager("Xtiitch", "another-key")

	secret, err := m.GenerateSecret()
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	ciphertext, err := m.EncryptSecret(secret)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if string(ciphertext) == secret {
		t.Fatalf("ciphertext must differ from plaintext")
	}
	got, err := m.DecryptSecret(ciphertext)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if got != secret {
		t.Fatalf("round trip mismatch: got %q want %q", got, secret)
	}

	// A different key must not decrypt.
	other := NewTOTPManager("Xtiitch", "wrong-key")
	if _, err := other.DecryptSecret(ciphertext); err == nil {
		t.Fatalf("expected decryption with wrong key to fail")
	}
}

func TestTOTPBackupCodes(t *testing.T) {
	t.Parallel()
	m := NewTOTPManager("Xtiitch", "k")

	codes, err := m.GenerateBackupCodes()
	if err != nil {
		t.Fatalf("backup codes: %v", err)
	}
	if len(codes) != m.codeNum {
		t.Fatalf("expected %d codes, got %d", m.codeNum, len(codes))
	}
	seen := map[string]bool{}
	for _, c := range codes {
		if seen[c] {
			t.Fatalf("duplicate backup code %q", c)
		}
		seen[c] = true
	}
	// Hashing normalises case and dashes, so a lower-cased, dash-stripped code
	// hashes to the same value the user was shown.
	normalized := strings.ToLower(strings.ReplaceAll(codes[0], "-", ""))
	if m.HashBackupCode(codes[0]) != m.HashBackupCode(normalized) {
		t.Fatalf("backup-code hash should be normalisation-insensitive")
	}
}
