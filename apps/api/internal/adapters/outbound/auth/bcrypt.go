package authadapter

import "golang.org/x/crypto/bcrypt"

type BcryptPasswordHasher struct {
	cost int
}

func NewBcryptPasswordHasher(cost int) BcryptPasswordHasher {
	if cost == 0 {
		cost = bcrypt.DefaultCost
	}

	return BcryptPasswordHasher{cost: cost}
}

func (hasher BcryptPasswordHasher) Hash(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), hasher.cost)
	if err != nil {
		return "", err
	}

	return string(hash), nil
}

func (hasher BcryptPasswordHasher) Compare(hash string, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}
