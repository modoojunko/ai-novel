import { useState, useEffect } from 'react';
import { request } from '../lib/api';

export default function DeviceManagePage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDevices = async () => {
    setLoading(true);
    const res = await request('/auth/devices');
    if (res.code === 0) {
      setDevices(res.data.devices);
    }
    setLoading(false);
  };

  useEffect(() => { loadDevices(); }, []);

  const handleRemove = async (hash: string, name: string) => {
    if (!confirm(`确定解绑 "${name}" 吗？`)) return;
    await request('/auth/devices/remove', {
      method: 'POST',
      body: JSON.stringify({ pc_hash: hash }),
    });
    loadDevices();
  };

  if (loading) return <div className="flex justify-center p-8"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">设备管理</h1>
      <p className="text-sm text-base-content/60 mb-4">最多绑定 3 台设备</p>
      {devices.length === 0 ? (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body text-center text-base-content/50">暂无已绑定设备</div>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((d, i) => (
            <div key={i} className="card bg-base-100 shadow-sm">
              <div className="card-body p-4 flex-row items-center justify-between">
                <div>
                  <p className="font-medium">{d.pc_name}</p>
                  <p className="text-xs text-base-content/50">最后活跃: {d.last_active_at?.slice(0, 10)}</p>
                </div>
                <button className="btn btn-ghost btn-sm text-error" onClick={() => handleRemove(d.pc_hash, d.pc_name)}>
                  解绑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
