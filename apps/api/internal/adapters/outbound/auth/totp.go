package authadapter

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// TOTPManager implements opt-in authenticator-app multi-factor auth (RFC 6238)
// with the standard library only — no third-party TOTP dependency. It also owns
// the at-rest encryption of the shared secret (AES-GCM) and backup-code hashing,
// so the application service stays free of crypto detail.
type TOTPManager struct {
	issuer  string
	aesKey  [32]byte
	period  uint64 // seconds per step (30)
	digits  int    // code length (6)
	skew    int64  // accepted ± steps either side of now (clock drift tolerance)
	codeLen int    // backup-code length in characters
	codeNum int    // number of backup codes minted
}

var (
	// ErrInvalidMFACiphertext is returned when a stored secret cannot be
	// decrypted (wrong key or tampered bytes).
	ErrInvalidMFACiphertext = errors.New("invalid mfa ciphertext")
)

// NewTOTPManager builds a manager. encryptionKeyMaterial may be any non-empty
// string; it is hashed to a fixed 32-byte AES key, so operators can supply a
// passphrase or a base64 key interchangeably. issuer is the label shown in the
// authenticator app (e.g. "Xtiitch").
func NewTOTPManager(issuer string, encryptionKeyMaterial string) TOTPManager {
	if strings.TrimSpace(issuer) == "" {
		issuer = "Xtiitch"
	}
	return TOTPManager{
		issuer:  issuer,
		aesKey:  sha256.Sum256([]byte(encryptionKeyMaterial)),
		period:  30,
		digits:  6,
		skew:    1,
		codeLen: 10,
		codeNum: 10,
	}
}

var base32NoPad = base32.StdEncoding.WithPadding(base32.NoPadding)

// GenerateSecret returns a fresh base32-encoded 20-byte secret (160 bits, the
// RFC 6238 / authenticator-app norm).
func (m TOTPManager) GenerateSecret() (string, error) {
	buf := make([]byte, 20)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base32NoPad.EncodeToString(buf), nil
}

// ProvisioningURI builds the otpauth:// URI an authenticator app scans. The
// client renders it as a QR code; nothing here ever leaves the server otherwise.
// The "Issuer:account" label keeps the colon literal (per the otpauth spec) and
// escapes the two parts independently.
func (m TOTPManager) ProvisioningURI(secret string, accountName string) string {
	label := url.PathEscape(m.issuer) + ":" + url.PathEscape(accountName)
	q := url.Values{}
	q.Set("secret", secret)
	q.Set("issuer", m.issuer)
	q.Set("algorithm", "SHA1")
	q.Set("digits", fmt.Sprintf("%d", m.digits))
	q.Set("period", fmt.Sprintf("%d", m.period))
	return "otpauth://totp/" + label + "?" + q.Encode()
}

// VerifyCode checks a user-entered code against the secret, accepting the step
// for `now` and ±skew adjacent steps to tolerate clock drift. To prevent replay
// (RFC 6238 §5.2) it only accepts steps strictly greater than afterStep (the
// last step the account already consumed) and returns the matched step so the
// caller can persist it. Comparison is constant-time.
func (m TOTPManager) VerifyCode(secret string, code string, now time.Time, afterStep int64) (int64, bool) {
	code = strings.TrimSpace(code)
	if len(code) != m.digits {
		return 0, false
	}
	key, err := base32NoPad.DecodeString(strings.ToUpper(strings.TrimSpace(secret)))
	if err != nil {
		return 0, false
	}
	counter := int64(uint64(now.Unix()) / m.period)
	for offset := -m.skew; offset <= m.skew; offset++ {
		step := counter + offset
		if step < 0 || step <= afterStep {
			continue
		}
		if subtle.ConstantTimeCompare([]byte(m.hotp(key, uint64(step))), []byte(code)) == 1 {
			return step, true
		}
	}
	return 0, false
}

// hotp computes the RFC 4226 HMAC-SHA1 one-time password for a counter.
func (m TOTPManager) hotp(key []byte, counter uint64) string {
	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], counter)
	mac := hmac.New(sha1.New, key)
	mac.Write(msg[:])
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	value := (uint32(sum[offset]&0x7f) << 24) |
		(uint32(sum[offset+1]) << 16) |
		(uint32(sum[offset+2]) << 8) |
		uint32(sum[offset+3])
	mod := uint32(1)
	for i := 0; i < m.digits; i++ {
		mod *= 10
	}
	return fmt.Sprintf("%0*d", m.digits, value%mod)
}

// backupCodeAlphabet excludes easily-confused characters (0/O, 1/I/L).
const backupCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

// GenerateBackupCodes mints single-use recovery codes shown to the user once.
func (m TOTPManager) GenerateBackupCodes() ([]string, error) {
	codes := make([]string, 0, m.codeNum)
	for i := 0; i < m.codeNum; i++ {
		var b strings.Builder
		for j := 0; j < m.codeLen; j++ {
			if j == m.codeLen/2 {
				b.WriteByte('-')
			}
			idx, err := randIndex(len(backupCodeAlphabet))
			if err != nil {
				return nil, err
			}
			b.WriteByte(backupCodeAlphabet[idx])
		}
		codes = append(codes, b.String())
	}
	return codes, nil
}

// randIndex returns a uniform random index in [0, n) using rejection sampling,
// avoiding the modulo bias of `randomByte % n` in a security primitive.
func randIndex(n int) (int, error) {
	limit := 256 - (256 % n)
	buf := make([]byte, 1)
	for {
		if _, err := rand.Read(buf); err != nil {
			return 0, err
		}
		if int(buf[0]) < limit {
			return int(buf[0]) % n, nil
		}
	}
}

// HashBackupCode hashes a backup code for storage/comparison. Backup codes are
// high-entropy, so a fast SHA-256 (over the normalised code) is appropriate.
func (m TOTPManager) HashBackupCode(code string) string {
	normalized := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(code), "-", ""))
	sum := sha256.Sum256([]byte(normalized))
	return hex.EncodeToString(sum[:])
}

// EncryptSecret seals the base32 secret with AES-256-GCM; the nonce is prefixed
// to the ciphertext.
func (m TOTPManager) EncryptSecret(secret string) ([]byte, error) {
	block, err := aes.NewCipher(m.aesKey[:])
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, []byte(secret), nil), nil
}

// DecryptSecret reverses EncryptSecret.
func (m TOTPManager) DecryptSecret(ciphertext []byte) (string, error) {
	block, err := aes.NewCipher(m.aesKey[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(ciphertext) < gcm.NonceSize() {
		return "", ErrInvalidMFACiphertext
	}
	nonce, sealed := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, sealed, nil)
	if err != nil {
		return "", ErrInvalidMFACiphertext
	}
	return string(plaintext), nil
}
