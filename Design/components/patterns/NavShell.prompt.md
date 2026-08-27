The app's navigation. Five destinations, no more — a sixth drops each tap target below 44px on a 375px screen.

```jsx
<NavShell active="/rides" onNavigate={go} items={NAV} />
<NavShell variant="sidebar" active="/rides" items={NAV}>{page}</NavShell>
```
