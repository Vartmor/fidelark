# Fidelark UI kit / 1.0

Run `ui/demo.html` in a browser (ideally a static local server; file:// also works for the page). This is an interactive **design-only mock**, not a real conversion engine.

## Integrate in a React / Vite project

```tsx
import '../branding/tokens/brand.css';
import '../branding/ui/components.css';
// <div className="f-app"><button className="f-btn f-btn-primary">Inspect a file</button></div>
```

- Use `[data-theme="dark"]` on `.f-app` for the dark scheme.
- Prefer real text labels with status icons; never communicate fidelity by color alone.
- The neutral accent does **not** mean successful conversion.
- Button states, focus ring, reduced motion, and error text are defined in components.css.
- Use product components as starting points: verify actual application flows, keyboard behavior and screen-reader names before production.
- Do not reuse demo static 'sample report' as evidence of product capability.
