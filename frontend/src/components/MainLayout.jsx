import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { registerPushNotifications, deregisterPushNotifications } from '../utils/pushNotifications.js';

export default function MainLayout() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('user');
  let user = null;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  }

  const userRole = user?.role || 'student';
  const isAdmin = userRole === 'admin';
  const isOfficer = userRole === 'officer';
  const isStaff = isAdmin || isOfficer;
  const isPrincipal = userRole === 'principal';
  
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [readNotifications, setReadNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMobileMore, setShowMobileMore] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
      registerPushNotifications((notification) => {
        loadNotifications();
        const title = notification.title || 'Notifikasi Baru';
        const body = notification.body || '';
        alert(`${title}\n\n${body}`);
      });
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        loadNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const saved = localStorage.getItem('read_notifications');
    if (saved) {
      try {
        setReadNotifications(JSON.parse(saved));
      } catch (_) {}
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userRole]);

  const loadNotifications = async () => {
    try {
      const res = await api.get('/transactions');
      const txs = res.data || [];
      
      const notifs = txs.map((t) => {
        const name = t.student?.name || 'Anggota';
        const nis = t.student?.nis || 'N/A';
        const bookCount = t.itemCount || 1;
        const time = t.borrowDate || t.createdAt;
        
        const isSelf = userRole === 'student';
        const subject = isSelf ? 'Anda' : `${name} (NIS: ${nis})`;
        
        let text = '';
        let icon = '📢';
        if (t.status === 'completed') {
          text = `${subject} mengembalikan ${bookCount} buku.`;
          icon = '✅';
        } else if (t.status === 'ongoing') {
          const today = new Date();
          const dueDate = new Date(t.dueDate);
          if (dueDate < today) {
            text = `${subject} terlambat mengembalikan ${bookCount} buku!`;
            icon = '⚠️';
          } else {
            text = `${subject} meminjam ${bookCount} buku.`;
            icon = '📤';
          }
        } else if (t.status === 'has_problem_pending') {
          text = `${subject} denda/kasus pending.`;
          icon = '❌';
        } else {
          text = `${subject} meminjam ${bookCount} buku.`;
          icon = '📋';
        }
        
        return {
          id: t.id,
          text,
          time,
          icon
        };
      });
      
      setNotifications(notifs);
      
      const savedRead = JSON.parse(localStorage.getItem('read_notifications') || '[]');
      const unread = notifs.filter(n => !savedRead.includes(n.id)).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Failed to load notifications in layout:', err);
    }
  };

  const handleMarkAllRead = () => {
    const allIds = notifications.map(n => n.id);
    localStorage.setItem('read_notifications', JSON.stringify(allIds));
    setReadNotifications(allIds);
    setUnreadCount(0);
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Baru saja';
      if (minutes < 60) return `${minutes} menit yang lalu`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} jam yang lalu`;
      const days = Math.floor(hours / 24);
      return `${days} hari yang lalu`;
    } catch {
      return '';
    }
  };
  
  const renderBell = (isMobile = false) => {
    const btnClass = isMobile ? 'mobile-bell' : 'sidebar-bell';
    const containerClass = isMobile ? 'mobile-bell-container' : 'sidebar-bell-container';
    
    return (
      <div className={containerClass}>
        <button 
          type="button" 
          className={`bell-button ${btnClass}`}
          onClick={() => setShowNotifications(!showNotifications)}
          title="Notifikasi Aktivitas"
        >
          🔔
          {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
        </button>
        
        {showNotifications && (
          <div className="notification-panel">
            <div className="notif-header">
              <h4>🔔 Notifikasi</h4>
              {unreadCount > 0 && (
                <button type="button" onClick={handleMarkAllRead} className="btn-mark-read">
                  Tandai dibaca
                </button>
              )}
            </div>
            <div className="notif-list">
              {notifications.map((n) => {
                const isUnread = !readNotifications.includes(n.id);
                return (
                  <div key={n.id} className={`notif-item ${isUnread ? 'unread' : ''}`}>
                    <div className="notif-item-icon">{n.icon}</div>
                    <div className="notif-item-text">
                      <p>{n.text}</p>
                      <small className="notif-item-time">{formatTimeAgo(n.time)}</small>
                    </div>
                  </div>
                );
              })}
              {notifications.length === 0 && (
                <div className="notif-empty">
                  <div className="notif-empty-icon">🔔</div>
                  <p>Belum ada notifikasi baru</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const handleLogout = async () => {
    await deregisterPushNotifications();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/Logo/logo.png" alt="Logo YP. Tunas Karya" className="sidebar-logo-icon" />
            <div>
              <div className="sidebar-logo-title">Perpustakaan</div>
              <div className="sidebar-logo-subtitle">YP. Tunas Karya</div>
            </div>
          </div>
          {user && (
            <div className="sidebar-utility-row">
              <span className="welcome-text">👋 Hai, {user.name || user.username}</span>
              {renderBell(false)}
            </div>
          )}
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/app" end className="nav-link">
            <span className="nav-icon">📊</span>
            <span>Dashboard</span>
          </NavLink>
          {(isStaff || isPrincipal || (userRole === 'teacher' && user.homeroomClass)) && (
            <NavLink to="/app/students" className="nav-link">
              <span className="nav-icon">👥</span>
              <span>Data Siswa</span>
            </NavLink>
          )}
          <NavLink to="/app/books" className="nav-link">
            <span className="nav-icon">📖</span>
            <span>{isStaff || isPrincipal ? 'Data Buku' : 'Katalog Buku'}</span>
          </NavLink>
          {isStaff && (
            <NavLink to="/app/scan" className="nav-link">
              <span className="nav-icon">📷</span>
              <span>Scan QR</span>
            </NavLink>
          )}
          {isStaff && (
            <NavLink to="/app/borrow" className="nav-link">
              <span className="nav-icon">📤</span>
              <span>Peminjaman</span>
            </NavLink>
          )}
          {isStaff && (
            <NavLink to="/app/return" className="nav-link">
              <span className="nav-icon">📥</span>
              <span>Pengembalian</span>
            </NavLink>
          )}
          <NavLink to="/app/transactions" className="nav-link">
            <span className="nav-icon">📋</span>
            <span>{isStaff || isPrincipal ? 'Transaksi' : userRole === 'teacher' ? 'Peminjaman Siswa' : 'Pinjaman Saya'}</span>
          </NavLink>
          {isAdmin && (
            <NavLink to="/app/accounts" className="nav-link">
              <span className="nav-icon">🧑‍💼</span>
              <span>Akun</span>
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">
              {(user?.name || user?.username)?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="user-info">
              {user ? (
                <>
                  <div className="user-name">{user.name || user.username}</div>
                  <div className="user-role">{user.role}</div>
                </>
              ) : (
                <div className="user-name">Belum login</div>
              )}
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="btn-logout">
            <span className="btn-logout-icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="mobile-header-content">
          <div className="mobile-logo">
            <img src="/Logo/logo.png" alt="Logo YP. Tunas Karya" className="mobile-logo-icon" />
            <div className="mobile-logo-text">
              <div className="mobile-logo-title">Perpustakaan</div>
              <div className="mobile-logo-subtitle">YP. Tunas Karya</div>
            </div>
          </div>
          <div className="mobile-user-info">
            {user && renderBell(true)}
            <div className="mobile-user-avatar">
              {user?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <button type="button" onClick={handleLogout} className="mobile-logout-btn" title="Logout">
              🚪
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>
      
      {/* Bottom Navigation for Mobile */}
      <nav className="bottom-nav">
        <div className="bottom-nav-scroll" style={{ justifyContent: 'space-around', overflow: 'hidden' }}>
          <NavLink to="/app" end className="bottom-nav-link">
            <span className="bottom-nav-icon">📊</span>
            <span className="bottom-nav-label">Dashboard</span>
          </NavLink>
          <NavLink to="/app/books" className="bottom-nav-link">
            <span className="bottom-nav-icon">📖</span>
            <span className="bottom-nav-label">{isStaff || isPrincipal ? 'Buku' : 'Katalog'}</span>
          </NavLink>
          {isStaff ? (
            <NavLink to="/app/scan" className="bottom-nav-link">
              <span className="bottom-nav-icon">📷</span>
              <span className="bottom-nav-label">Scan</span>
            </NavLink>
          ) : (
            <NavLink to="/app/transactions" className="bottom-nav-link">
              <span className="bottom-nav-icon">📋</span>
              <span className="bottom-nav-label">{userRole === 'teacher' ? 'Pinjaman Siswa' : 'Pinjaman'}</span>
            </NavLink>
          )}
          <button 
            type="button" 
            className="bottom-nav-link" 
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setShowMobileMore(true)}
          >
            <span className="bottom-nav-icon">⚙️</span>
            <span className="bottom-nav-label">Lainnya</span>
          </button>
        </div>
      </nav>

      {/* Drawer Bottom Sheet Menu Mobile */}
      {showMobileMore && (
        <div className="mobile-more-overlay" onClick={() => setShowMobileMore(false)}>
          <div className="mobile-more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-header">
              <div className="mobile-sheet-user">
                <div className="mobile-sheet-avatar">
                  {(user?.name || user?.username)?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="mobile-sheet-details">
                  <span className="mobile-sheet-name">{user?.name || user?.username}</span>
                  <span className="mobile-sheet-role">{user?.role}</span>
                </div>
              </div>
              <button 
                type="button" 
                className="mobile-sheet-close" 
                onClick={() => setShowMobileMore(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="mobile-sheet-nav">
              {(isStaff || isPrincipal || (userRole === 'teacher' && user.homeroomClass)) && (
                <NavLink 
                  to="/app/students" 
                  className="mobile-sheet-link"
                  onClick={() => setShowMobileMore(false)}
                >
                  <div className="mobile-sheet-link-content">
                    <span className="mobile-sheet-link-icon">👥</span>
                    <span>Data Siswa</span>
                  </div>
                  <span className="mobile-sheet-link-arrow">❯</span>
                </NavLink>
              )}
              
              {isStaff && (
                <>
                  <NavLink 
                    to="/app/borrow" 
                    className="mobile-sheet-link"
                    onClick={() => setShowMobileMore(false)}
                  >
                    <div className="mobile-sheet-link-content">
                      <span className="mobile-sheet-link-icon">📤</span>
                      <span>Peminjaman</span>
                    </div>
                    <span className="mobile-sheet-link-arrow">❯</span>
                  </NavLink>
                  
                  <NavLink 
                    to="/app/return" 
                    className="mobile-sheet-link"
                    onClick={() => setShowMobileMore(false)}
                  >
                    <div className="mobile-sheet-link-content">
                      <span className="mobile-sheet-link-icon">📥</span>
                      <span>Pengembalian</span>
                    </div>
                    <span className="mobile-sheet-link-arrow">❯</span>
                  </NavLink>

                  <NavLink 
                    to="/app/transactions" 
                    className="mobile-sheet-link"
                    onClick={() => setShowMobileMore(false)}
                  >
                    <div className="mobile-sheet-link-content">
                      <span className="mobile-sheet-link-icon">📋</span>
                      <span>Transaksi</span>
                    </div>
                    <span className="mobile-sheet-link-arrow">❯</span>
                  </NavLink>
                </>
              )}
              
              {isAdmin && (
                <NavLink 
                  to="/app/accounts" 
                  className="mobile-sheet-link"
                  onClick={() => setShowMobileMore(false)}
                >
                  <div className="mobile-sheet-link-content">
                    <span className="mobile-sheet-link-icon">🧑‍💼</span>
                    <span>Pengaturan Akun</span>
                  </div>
                  <span className="mobile-sheet-link-arrow">❯</span>
                </NavLink>
              )}
            </div>
            
            <button 
              type="button" 
              className="mobile-sheet-logout" 
              onClick={() => {
                setShowMobileMore(false);
                handleLogout();
              }}
            >
              🚪 Keluar dari Aplikasi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


