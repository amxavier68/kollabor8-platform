# Security Guidelines

## Authentication

- Passwords: bcrypt with 12 rounds minimum
- JWT: 256-bit secrets
- Tokens: 1h access, 7d refresh
- 2FA: TOTP with 6-digit codes

## API Security

- Rate limiting: 100 req/15min per IP
- CORS: Explicit origins only
- Input validation: Joi schemas
- SQL injection: Parameterized queries
- XSS: Content Security Policy

## Data Protection

- PII encryption at rest
- HTTPS only in production
- Database auth required
- Secrets in environment variables
- No credentials in code

## Code Review Checklist

- [ ] No hardcoded secrets
- [ ] Input validated
- [ ] Auth checked
- [ ] Rate limiting applied
- [ ] Error messages safe
- [ ] Logging no PII
