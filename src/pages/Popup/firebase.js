import { initializeApp } from 'firebase/app';
// import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCDRYUiuNWzw84gmvjl4ca1-0ZdPy-oUI8',
  authDomain: 'timio-news.firebaseapp.com',
  projectId: 'timio-news',
  storageBucket: 'timio-news.appspot.com',
  messagingSenderId: '719978811048',
  appId: '1:719978811048:web:82339ca69c581c5204bc9d',
  measurementId: 'G-5C7PYX7G6E',
};

export const app = initializeApp(firebaseConfig);
// export const auth = getAuth(app);
