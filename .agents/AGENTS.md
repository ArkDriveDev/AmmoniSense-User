# Workspace Rules for AmmoniSense

## Professional Git Commit Standards

### 1. Commit Size & Granularity Guidelines
- **Single Responsibility**: Each commit MUST represent ONE logical unit of work (e.g., adding a single component, updating a single service method, or adding a type definition).
- **Small & Focused (< 100 lines)**: Target 20 to 50 lines per commit. Under NO circumstances should any commit exceed 100 total lines changed (insertions + deletions < 100). Never combine unrelated file changes or multiple features into a single commit.
- **Isolation of Concerns**:
  - Do NOT mix bug fixes with new features.
  - Do NOT mix refactoring with functional changes.
  - Do NOT stage all modified files at once using `git add .` or `git commit -a`. Large new files or deletions MUST be split incrementally across multiple micro-commits of < 100 lines each.
- **Incremental Staging**: Stage files individually or in small chunks using explicit file paths or partial hunk staging (`git add src/components/map/PolygonPreview.css`).
- **Working Code Requirement**: Every commit must leave the codebase in a compilable, buildable state (`tsc && vite build` must pass).

### 2. Conventional Commits Format
All commit messages MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) standard:

```text
<type>(<scope>): <description>
```

#### Types:
- `feat`: A new feature, component, or capability
- `fix`: A bug fix or issue resolution
- `refactor`: Code structure changes that neither fix a bug nor add a feature
- `style`: Markup, layout, CSS/SCSS visual styling changes with no logic alterations
- `test`: Adding or refactoring automated tests
- `docs`: Documentation updates (README, docstrings, walkthroughs)
- `chore`: Maintenance, dependencies, build or tooling configuration changes

#### Scopes:
Specify the exact module, feature area, or component affected:
- `map`, `ble`, `sites`, `storage`, `sync`, `auth`, `ui`

#### Examples: