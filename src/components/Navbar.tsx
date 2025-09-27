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
          <li>
            {!isPending && (
              <button className="btn" onClick={logout}>
                Logout
              </button>
            )}
            {isPending && (
              <button className="btn" disabled>
                Logging out...
              </button>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}
