import { Link } from "react-router-dom";
import { useLogout } from "../hooks/useLogout";
import { useAuthContext } from "../hooks/useAuthContext";

//styles & images
import styles from "./Navbar.module.css";
import logo from "../assets/logo.svg";

export default function Navbar() {
  const { logout, isPending } = useLogout();
  const { user } = useAuthContext();

  return (
    <div className={styles.navbar}>
      <ul>
        <li className={styles.logo}>
          <Link to="/">
            <img src={logo} alt="website logo" />
            <span>Policy Compass</span>
          </Link>
        </li>
        {!user && (
          <>
            <li>
              <Link className={styles.link} to="/login">
                Login
              </Link>
            </li>
            <li>
              <Link className={styles.link} to="/signup">
                Signup
              </Link>
            </li>
          </>
        )}
        {user && (
          <li className={styles.userSection}>
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>
                {user.email?.charAt(0).toUpperCase()}
              </div>
            </div>
            {!isPending && (
              <button className={styles.logoutBtn} onClick={logout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16,17 21,12 16,7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Logout
              </button>
            )}
            {isPending && (
              <button className={styles.logoutBtn} disabled>
                <div className={styles.spinner}></div>
                Logging out...
              </button>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}
