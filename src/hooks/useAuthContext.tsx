import { AuthContext } from "../context/AuthContext"
import { useContext } from "react"

/**
 * Custom hook to access the authentication context.
 *
 *
 * @returns {{user, authIsReady}} The current authentication context value.
 * @throws {Error} If the hook is used outside of an AuthContextProvider.
 * 
 * Can use user variable to check if user is logged in. Can use this to show certain components or redirect users.
 * 
 * @example
 * import { useAuthContext } from "./hooks/useAuthContext";
 * const { user, authIsReady } = useAuthContext();
 */
export const useAuthContext = () => {
  const context = useContext(AuthContext)

  if(!context) {
    throw Error('useAuthContext must be used inside an AuthContextProvider')
  }

  return context
}