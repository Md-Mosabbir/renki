For choices that need explaining — gender at signup, who you are matched with. Selected row gets the amber border and tint.

```jsx
<RadioGroup value={pref} onChange={setPref} options={[
  { value: 'same', label: 'Only riders of my gender', description: 'The default. You will see fewer matches.' },
  { value: 'all', label: 'Riders of any gender', description: 'More matches, sooner.' },
]} />
```
