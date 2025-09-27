import { useState, useEffect } from "react";

//firebase imports
import { auth, timestamp, db } from "../firebase/config";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useAuthContext } from "./useAuthContext";
import { doc, setDoc } from "firebase/firestore";



type SignupReturn = {
  signup: (email: string, password: string) => Promise<void>;
  error: string | null;
  isPending: boolean;
};
/**
 * Custom React hook for signing up a new user with email and password.
 * Handles user creation, error management, and pending state.
 * Also creates a user document in Firestore and dispatches a login action.
 *
 * @returns {{
 *   signup: (email: string, password: string) => Promise<void>,
 *   error: string | null,
 *   isPending: boolean
 * }} An object containing the signup function, error message, and pending state.
 */
export const useSignup = (): SignupReturn => {
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);
  const { dispatch } = useAuthContext();

  const signup = async (email: string, password: string): Promise<void> => {
    setError(null);
    setIsPending(true);

    try {
      // signup
      const res = await createUserWithEmailAndPassword(auth, email, password);

      if (!res) {
        throw new Error("Could not complete signup");
      }

      //create a user document
      const createdAt = timestamp.fromDate(new Date());
      await setDoc(doc(db, "users", res.user.uid), {
        createdAt,
      });

      // dispatch login action
      dispatch({ type: "LOGIN", payload: res.user });

      if (!isCancelled) {
        setIsPending(false);
        setError(null);
      }
    } catch (err: any) {
      if (!isCancelled) {
        setError(err.message);
        setIsPending(false);
      }
    }
  };

  useEffect(() => {
    return () => setIsCancelled(true);
  }, []);

  return { signup, error, isPending };
};
