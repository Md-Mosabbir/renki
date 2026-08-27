Use when one payload is worth viewing from a few angles (friends / requests / awaiting meetup). Not for navigation.

```jsx
<Tabs tabs={[{value:'friends',label:'Friends',count:12},{value:'incoming',label:'Requests',count:2}]}>
  {(active) => (active === 'friends' ? <FriendList /> : <RequestList />)}
</Tabs>
```
