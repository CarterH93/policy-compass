import { useState } from "react";
import { useLogin } from "../../hooks/useLogin";

//styles
import styles from "./Login.module.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isPending, error } = useLogin();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    login(email, password);
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>Sign in to your Policy Compass account</p>
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
              placeholder="Enter your password"
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
            className={`${styles.loginButton} ${isPending ? styles.loading : ''}`}
            disabled={isPending}
            type="submit"
          >
            {isPending ? (
              <>
                <svg className={styles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                Signing in...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  <polyline points="10,17 15,12 10,7"></polyline>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                Sign In
              </>
            )}
          </button>
        </form>
        
        <div className={styles.footer}>
          <p className={styles.footerText}>
            Don't have an account? 
            <a href="/signup" className={styles.link}>Create one here</a>
          </p>
        </div>
      </div>
    </div>
  );
}
