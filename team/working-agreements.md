# TLE Team Working Agreements

## Core Hours

- Team available: 9:00 AM - 5:00 PM (your timezone)
- Daily standup: 9:30 AM (15 min max)
- No meetings after 4:00 PM
- Async-first communication

## Communication

- Urgent: Slack DM
- Important: Slack channel mention
- FYI: Slack channel message
- Response time: < 2 hours during core hours

## Code Standards

- TypeScript strict mode
- ESLint + Prettier enforced
- 80%+ test coverage
- No commits to main directly
- PR requires 1 approval minimum
- PR max size: 500 lines

## Definition of Done

- [ ] Code written & tested locally
- [ ] Unit tests added (>80% coverage)
- [ ] Integration tests for API changes
- [ ] PR approved by 1 team member
- [ ] CI/CD pipeline passes
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Manual QA passed

## Git Commit Convention

format: type(scope): message

Types:

- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructure
- test: Add tests
- chore: Maintenance

Examples:

- feat(auth): add 2FA support
- fix(api): resolve CORS issue
- docs(readme): update setup instructions
