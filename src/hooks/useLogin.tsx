import { useState, useEffect } from "react";

//firebase imports
import { auth } from "../firebase/config";
import { useAuthContext } from "./useAuthContext";
import { signInWithEmailAndPassword } from "firebase/auth";



type UseLoginResult = {
  login: (email: string, password: string) => Promise<void>;
  isPending: boolean;
  error: string | null;
};
/**
 * Custom React hook for handling user login with Firebase authentication.
 *
 * @returns {{
 *   login: (email: string, password: string) => Promise<void>,
 *   isPending: boolean,
 *   error: string | null
 * }} An object containing the login function, loading state, and error message.
 *
 * @example
 * const { login, isPending, error } = useLogin();
 * await login('user@example.com', 'password123');
 */
export const useLogin = (): UseLoginResult => {
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);
  const { dispatch } = useAuthContext();

  const login = async (email: string, password: string): Promise<void> => {
    setError(null);
    setIsPending(true);

    try {
      // login
      const res = await signInWithEmailAndPassword(auth, email, password);

      // dispatch login action
      dispatch({ type: "LOGIN", payload: res.user });

      //Run any code you want to do right after login here

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

  return { login, isPending, error };
};
