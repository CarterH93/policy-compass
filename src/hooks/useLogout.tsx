import { useEffect, useState } from "react";

//firebase imports
import { auth } from "../firebase/config";
import { signOut } from "firebase/auth";
import { useAuthContext } from "./useAuthContext";

/**
 * Custom hook to handle user logout functionality.
 *
 * Manages logout state, error handling, and cancellation to prevent memory leaks.
 * Dispatches a logout action to the authentication context and signs the user out.
 *
 * @returns {Object} An object containing:
 *   - logout {Function}: Asynchronous function to log out the user.
 *   - error {string|null}: Error message if logout fails, otherwise null.
 *   - isPending {boolean}: Indicates if the logout process is ongoing.
 */
export const useLogout = () => {
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);
  const { dispatch } = useAuthContext();

  const logout = async (): Promise<void> => {
    setError(null);
    setIsPending(true);

    try {
      //Run any code you want to do right before logout here

      // sign the user out
      await signOut(auth);

      // dispatch logout action
      dispatch({ type: "LOGOUT" });

      // update state
      if (!isCancelled) {
        setIsPending(false);
        setError(null);
      }
    } catch (err) {
      if (!isCancelled) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(String(err));
        }
        setIsPending(false);
      }
    }
  };

  useEffect(() => {
    return () => setIsCancelled(true);
  }, []);

  return { logout, error, isPending } as const;
};
