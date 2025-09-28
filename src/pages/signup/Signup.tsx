import { useState } from "react";
import { useSignup } from "../../hooks/useSignup";

//styles
import styles from "./Signup.module.css";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signup, error, isPending } = useSignup();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    signup(email, password);
  };

  return (
    <div className={styles.container}>
      <div className={styles.signupCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Join Policy Compass</h1>
          <p className={styles.subtitle}>Create your account to get started</p>
        </div>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              Email Address
            </label>
            <input
              type="email"
              required
              onChange={(e) => setEmail(e.target.value)}
              value={email}
              className={styles.input}
              placeholder="Enter your email"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              Password
            </label>
            <input
              type="password"
              required
              onChange={(e) => setPassword(e.target.value)}
              value={password}
              className={styles.input}
              placeholder="Create a password"
            />
          </div>
          
          {error && (
            <div className={styles.error}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              {error}
            </div>
          )}
          
          <button 
            className={`${styles.signupButton} ${isPending ? styles.loading : ''}`}
            disabled={isPending}
            type="submit"
          >
            {isPending ? (
              <>
                <svg className={styles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                Creating account...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                Create Account
              </>
            )}
          </button>
        </form>
        
        <div className={styles.footer}>
          <p className={styles.footerText}>
            Already have an account? 
            <a href="/login" className={styles.link}>Sign in here</a>
          </p>
        </div>
      </div>
    </div>
  );
}
