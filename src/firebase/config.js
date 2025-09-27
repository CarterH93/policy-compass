import { initializeApp } from "firebase/app";
import { getFirestore, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAnGApTsZ8ipE8Nlvl02_zKsdOr7b0wwEA",
  authDomain: "policy-compass-ce8c0.firebaseapp.com",
  projectId: "policy-compass-ce8c0",
  storageBucket: "policy-compass-ce8c0.firebasestorage.app",
  messagingSenderId: "915077569705",
  appId: "1:915077569705:web:da3870f9db439236a71db8"
};

//init firebase
initializeApp(firebaseConfig);

//init firestore
const db = getFirestore();

//init firebase auth
const auth = getAuth();

//timestamp
const timestamp = Timestamp;

export { db, auth, timestamp };



