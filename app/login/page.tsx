'use client';

import { useState } from 'react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password.trim() || loading) return;

        setLoading(true);
        setErrorMsg('');

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    password: password.trim(),
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // 성공 시 권한에 맞는 목적지로 이동
                window.location.href = data.redirectTo || '/';
            } else {
                setErrorMsg(data.message || '이메일 또는 비밀번호가 올바르지 않습니다.');
                setLoading(false);
            }
        } catch (err) {
            setErrorMsg('로그인 통신 중 오류가 발생했습니다.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-6">

                {/* 타이틀 */}
                <div className="text-center flex flex-col items-center gap-2">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl shadow-xs">
                        🏨
                    </div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">숙소 통합 관리 시스템</h1>
                    <p className="text-xs text-slate-500 font-bold">계정으로 로그인해 주세요</p>
                </div>

                {/* 폼 */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* 이메일 */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-black text-slate-700">이메일</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (errorMsg) setErrorMsg('');
                            }}
                            placeholder="admin@dewave.com"
                            autoFocus
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm font-bold text-slate-900 transition"
                        />
                    </div>

                    {/* 비밀번호 */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-black text-slate-700">비밀번호</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (errorMsg) setErrorMsg('');
                            }}
                            placeholder="비밀번호 입력"
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm font-bold text-slate-900 transition"
                        />
                    </div>

                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold flex items-center gap-1.5">
                            <span>⚠️</span>
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 mt-2 rounded-xl font-black text-sm md:text-base bg-blue-600 hover:bg-blue-700 text-white shadow-md transition cursor-pointer active:scale-98 flex items-center justify-center gap-2"
                    >
                        {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                        <span>{loading ? '로그인 확인 중...' : '로그인'}</span>
                    </button>
                </form>

            </div>
        </div>
    );
}