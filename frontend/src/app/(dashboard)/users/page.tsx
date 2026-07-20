'use client';

import React, { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { formatDate, getRoleBadgeColor } from '@/lib/utils';
import { hasRole, getSession } from '@/lib/auth';

interface UserItem {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: 'OWNER' | 'MANAGER' | 'KASIR' | 'GUDANG';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: 'KASIR' as const,
  });
  const [submitting, setSubmitting] = useState(false);

  const session = getSession();
  const isOwner = hasRole('OWNER');

  const loadUsers = async () => {
    setLoading(true);
    const res = await fetchApi<UserItem[]>('/users');
    if (res.ok && res.data) setUsers(res.data);
    setLoading(false);
  };

  useEffect(() => {
    if (isOwner) loadUsers();
  }, [isOwner]);

  if (!isOwner) {
    return (
      <div className="rounded-2xl bg-rose-500/10 p-8 border border-rose-500/30 text-center text-rose-300">
        <h3 className="text-lg font-bold">Akses Ditolak (403 Forbidden)</h3>
        <p className="mt-2 text-sm">Hanya Pemilik Toko (OWNER) yang memiliki hak akses untuk mengelola pengguna dan role.</p>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetchApi('/users', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    setSubmitting(false);

    if (res.ok) {
      alert('Pengguna baru berhasil ditambahkan dan dicatat pada AuditLog!');
      setShowCreateModal(false);
      setForm({ username: '', fullName: '', email: '', password: '', role: 'KASIR' });
      loadUsers();
    } else {
      alert(res.error || 'Gagal menambahkan pengguna baru.');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`Apakah Anda yakin ingin mengubah hak akses role pengguna ini menjadi ${newRole}?`)) return;
    const res = await fetchApi(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole }),
    });

    if (res.ok) {
      alert('Role berhasil diperbarui dan dicatat ke AuditLog.');
      loadUsers();
    } else {
      alert(res.error || 'Gagal mengubah role');
    }
  };

  const handleDeactivate = async (userId: string, username: string) => {
    if (!confirm(`Nonaktifkan akun "${username}"? Akun tidak akan bisa login lagi.`)) return;
    const res = await fetchApi(`/users/${userId}/deactivate`, {
      method: 'PUT',
    });

    if (res.ok) {
      alert('Akun dinonaktifkan.');
      loadUsers();
    } else {
      alert(res.error || 'Gagal menonaktifkan akun');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white">Manajemen Akun & Role RBAC (Owner Only)</h3>
          <p className="text-xs text-gray-400">Pengaturan akses bertingkat: Owner, Manager, Kasir, Staff Gudang</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:from-blue-500 hover:to-indigo-500 transition-all"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          <span>Tambah Pengguna Baru</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-800/80 text-xs uppercase text-gray-400 font-semibold border-b border-gray-700/60">
              <tr>
                <th className="py-4 px-6">Username / Nama Lengkap</th>
                <th className="py-4 px-4">Email</th>
                <th className="py-4 px-4 text-center">Role RBAC</th>
                <th className="py-4 px-4 text-center">Status Akun</th>
                <th className="py-4 px-4 font-mono text-xs">Login Terakhir</th>
                <th className="py-4 px-6 text-center">Aksi & Ubah Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">Memuat daftar pengguna...</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-800/40">
                  <td className="py-4 px-6">
                    <div className="font-bold text-white">{u.fullName}</div>
                    <span className="text-xs text-blue-400 font-mono">@{u.username}</span>
                  </td>
                  <td className="py-4 px-4 text-xs text-gray-400">{u.email}</td>
                  <td className="py-4 px-4 text-center">
                    {u.username === 'owner' ? (
                      <span className={`inline-block rounded-full px-3 py-1 font-bold text-xs border ${getRoleBadgeColor(u.role)}`}>
                        {u.role} (Master)
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className={`glass-input rounded-lg px-2.5 py-1 text-xs font-bold border ${getRoleBadgeColor(u.role)}`}
                      >
                        <option value="OWNER" className="bg-dark-800 text-purple-300">OWNER</option>
                        <option value="MANAGER" className="bg-dark-800 text-blue-300">MANAGER</option>
                        <option value="KASIR" className="bg-dark-800 text-emerald-300">KASIR</option>
                        <option value="GUDANG" className="bg-dark-800 text-amber-300">GUDANG</option>
                      </select>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      u.isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {u.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-xs font-mono text-gray-400">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Belum pernah login'}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {u.username !== 'owner' && u.isActive && (
                      <button
                        onClick={() => handleDeactivate(u.id, u.username)}
                        className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition-all"
                      >
                        Nonaktifkan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create User */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4">Tambah Pengguna / Staff Baru</h3>
            <form onSubmit={handleCreateUser} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Username (Login)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: kasir2"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="glass-input w-full rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="glass-input w-full rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="budi@toko.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="glass-input w-full rounded-xl px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Role Akses</label>
                  <select
                    value={form.role}
                    onChange={(e: any) => setForm({ ...form, role: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2 text-gray-200 font-semibold"
                  >
                    <option value="KASIR" className="bg-dark-800">KASIR (POS)</option>
                    <option value="GUDANG" className="bg-dark-800">GUDANG (Stok)</option>
                    <option value="MANAGER" className="bg-dark-800">MANAGER (Laporan)</option>
                    <option value="OWNER" className="bg-dark-800">OWNER (Full)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Min. 8 karakter"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
