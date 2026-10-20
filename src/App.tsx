import { useAuth } from './lib/auth';
import { useHashRoute, match } from './lib/router';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { Profile } from './pages/Profile';
import { Vacancies, VacancyDetail } from './pages/Vacancies';
import { Auth } from './pages/Auth';
import { AccountForm } from './pages/AccountForm';
import { Dashboard } from './pages/Dashboard';
import { Inbox, Chat } from './pages/Inbox';
import { Support } from './pages/Support';
import { Admin } from './pages/Admin';
import { Control } from './pages/Control';
import { Legal } from './pages/Legal';
import { NotFound } from './pages/NotFound';
import { RequireAuth } from './components/RequireAuth';

const ROUTES: [string, (p: Record<string, string>) => JSX.Element, boolean?][] = [
  ['/', () => <Home />],
  ['/talent', () => <Catalog kind="mutaxassis" />],
  ['/company', () => <Catalog kind="kompaniya" />],
  ['/center', () => <Catalog kind="oquv_markazi" />],
  ['/shop', () => <Catalog kind="sotuvchi" />],
  ['/talent/:username', (p) => <Profile kind="mutaxassis" username={p.username} />],
  ['/company/:username', (p) => <Profile kind="kompaniya" username={p.username} />],
  ['/center/:username', (p) => <Profile kind="oquv_markazi" username={p.username} />],
  ['/shop/:username', (p) => <Profile kind="sotuvchi" username={p.username} />],
  ['/client/:username', (p) => <Profile kind="mijoz" username={p.username} />],
  ['/vacancies', () => <Vacancies kind="vacancy" />],
  ['/casting', () => <Vacancies kind="casting" />],
  ['/vacancy/:id', (p) => <VacancyDetail id={p.id} />],
  ['/login', () => <Auth mode="login" />],
  ['/register', () => <Auth mode="register" />],
  ['/onboarding', () => <RequireAuth><AccountForm key="pick" /></RequireAuth>],
  ['/onboarding/:kind', (p) => <RequireAuth><AccountForm key={`kind-${p.kind}`} kind={p.kind} /></RequireAuth>],
  ['/edit/:id', (p) => <RequireAuth><AccountForm key={`edit-${p.id}`} editId={p.id} /></RequireAuth>],
  ['/dashboard', () => <RequireAuth><Dashboard /></RequireAuth>],
  ['/inbox', () => <RequireAuth><Inbox /></RequireAuth>],
  ['/chat/:id', (p) => <RequireAuth><Chat id={p.id} /></RequireAuth>],
  ['/support', () => <RequireAuth><Support /></RequireAuth>],
  ['/admin', () => <RequireAuth admin><Admin /></RequireAuth>],
  ['/boshqaruv', () => <RequireAuth admin><Control /></RequireAuth>],
  ['/legal/:doc', (p) => <Legal doc={p.doc} />]
];

export default function App() {
  const [path] = useHashRoute();
  const { loading, loadError, refresh, user, isBanned, signOut } = useAuth();

  let page: JSX.Element = <NotFound />;
  for (const [pattern, render] of ROUTES) {
    const params = match(pattern, path);
    if (params) {
      page = render(params);
      break;
    }
  }

  return (
    <Layout path={path}>
      <div className="container page">
        {user && loadError && (
          <div className="notice error" role="alert">
            <p style={{ color: '#ffb3b3', margin: '0 0 10px' }}>{loadError}</p>
            <button className="btn sm" onClick={() => void refresh()}>Qayta urinish</button>
          </div>
        )}
        {user && isBanned && path !== '/support' ? (
          <div className="notice error" role="alert" style={{ padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>Akkauntingiz bloklangan</h2>
            <p>Platformadan foydalanish cheklangan. Savollar bo‘lsa, support orqali murojaat qiling.</p>
            <div className="row" style={{ gap: 8 }}>
              <a className="btn" href="#/support">Support</a>
              <button className="btn" onClick={() => void signOut()}>Chiqish</button>
            </div>
          </div>
        ) : loading ? <Loading /> : page}
      </div>
    </Layout>
  );
}

