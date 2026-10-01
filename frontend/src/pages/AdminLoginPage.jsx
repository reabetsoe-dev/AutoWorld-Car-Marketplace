import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LockKeyhole, LogIn, UserRound } from 'lucide-react';
import { adminLogin, buildErrorMessage } from '../services/api';
import { isAuthenticated } from '../services/auth';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_DASHBOARD_PATH } from '../config/adminPaths';
import { showroomImages } from '../data/visualAssets';

const schema = z.object({
  username: z.string().trim().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.')
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' }
  });

  if (isAuthenticated()) {
    return <Navigate to={ADMIN_DASHBOARD_PATH} replace />;
  }

  async function onSubmit(values) {
    setError('');
    try {
      const response = await adminLogin(values);
      login(response);
      navigate(ADMIN_DASHBOARD_PATH);
    } catch (err) {
      setError(buildErrorMessage(err));
    }
  }

  return (
    <section className="admin-login-page" style={{ '--admin-login-bg': `url(${showroomImages.adminLogin})` }}>
      <form className="panel admin-login-card" onSubmit={handleSubmit(onSubmit)}>
        <div className="section-head">
          <span className="section-kicker">Private dashboard</span>
        </div>

        <div className="field-group">
          <label htmlFor="username">
            <UserRound size={15} />
            Username
          </label>
          <input id="username" autoComplete="username" {...register('username')} />
          {errors.username ? <p className="text-sm text-red-400">{errors.username.message}</p> : null}
        </div>

        <div className="field-group">
          <label htmlFor="password">
            <LockKeyhole size={15} />
            Password
          </label>
          <input id="password" type="password" autoComplete="current-password" {...register('password')} />
          {errors.password ? <p className="text-sm text-red-400">{errors.password.message}</p> : null}
        </div>

        <div className="button-row">
          <button className="btn btn--primary" type="submit" disabled={isSubmitting}>
            <LogIn size={17} />
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </div>

        {error ? <p className="notice notice--error">{error}</p> : null}
      </form>
    </section>
  );
}

export default AdminLoginPage;
