// Placeholder content for the kit. Names and places are invented; every
// number here is fake and labelled as such on screen where it matters.
window.RENKI_DATA = {
  me: { name: 'Sadia Rahman', email: 'sadia.rahman@northsouth.edu', university: 'North South University', gender: 'female', stage: 'Active', studentId: '2021-1-60-104', dob: '2003-04-11', phone: '01712 345 678' },
  deck: [
    { id: 'a', name: 'Imran Kabir', accepted: true, stage: 'Established rider', origin: 'NSU gate 1', destination: 'Dhanmondi 27', km: 0.8, time: '6:30 PM', apart: 5 },
    { id: 'b', name: 'Nusrat Jahan', accepted: false, stage: 'Active', origin: 'NSU gate 3', destination: 'Bashundhara R/A', km: 1.4, time: '6:45 PM', apart: 20 },
    { id: 'c', name: 'Rafi Chowdhury', accepted: false, stage: 'Active', origin: 'NSU gate 1', destination: 'Banani 11', km: 2.1, time: '7:05 PM', apart: 40 },
  ],
  friends: [
    { name: 'Imran Kabir', note: 'Met 3 Mar' },
    { name: 'Nusrat Jahan', note: 'Met 18 Feb' },
    { name: 'Tanvir Hossain', note: 'Met 2 Feb' },
  ],
  incoming: [{ name: 'Rafi Chowdhury', note: 'Wants to be friends' }],
  awaiting: [{ name: 'Mehedi Alam', note: 'Accepted — meet up and scan' }],
  groups: [
    { id: 'g1', origin: 'NSU', destination: 'Dhanmondi 27', departure: 'Fri 14 Mar, 6:30 PM', status: 'matched', members: [{ name: 'Sadia Rahman', organiser: true }, { name: 'Imran Kabir' }], pendingCount: 0 },
    { id: 'g2', origin: 'NSU', destination: 'Bashundhara R/A', departure: 'Sat 15 Mar, 8:10 AM', status: 'forming', members: [{ name: 'Sadia Rahman', organiser: true }, { name: 'Nusrat Jahan' }, { name: 'Tanvir Hossain', status: 'pending' }], pendingCount: 1 },
  ],
  history: [
    { origin: 'NSU', destination: 'Dhanmondi 27', when: '9 Mar, 6:40 PM', with: 'Imran' },
    { origin: 'Banani 11', destination: 'NSU', when: '7 Mar, 8:15 AM', with: 'Nusrat, Tanvir' },
  ],
};
