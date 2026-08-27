Renki's button — ink fill, the wordmark's amber square at the leading edge, and an amber rule that wipes across the bottom on hover. Amber never fills a button; it signs and marks it.

```jsx
<Button size="xl" block>Continue</Button>
<Button variant="outline" size="sm">Decline</Button>
<Button variant="ghost" size="icon"><i data-lucide="x" /></Button>
<Button mark={false}>Skip</Button>
```

`size="xl"` is the editorial CTA: uppercase, 0.1em tracked, square, and (with `block`) label pushed to the outer edges. The mark rotates 45° on hover; press shifts the button down 1px. There is no shadow, ever.
