'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/database.types';
import { useRouter } from 'next/navigation';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function NewGroupPage() {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    
    setUsers(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // グループを作成
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: groupName,
          description: description,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // 選択されたユーザーをグループに追加
      const userGroupRelations = selectedUsers.map(userId => ({
        group_id: group.id,
        user_id: userId
      }));

      const { error: relationError } = await supabase
        .from('user_group_relations')
        .insert(userGroupRelations);

      if (relationError) throw relationError;

      router.push('/groups');
    } catch (error) {
      console.error('Error creating group:', error);
      alert('グループの作成に失敗しました。');
    }
  };

  const toggleUser = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">新規グループ作成</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            グループ名
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            説明
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            メンバー
          </label>
          <div className="border rounded p-4 max-h-60 overflow-y-auto">
            {users.map((user) => (
              <div key={user.id} className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  id={`user-${user.id}`}
                  checked={selectedUsers.includes(user.id)}
                  onChange={() => toggleUser(user.id)}
                  className="h-4 w-4"
                />
                <label htmlFor={`user-${user.id}`}>
                  {user.name} ({user.organization})
                </label>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          グループを作成
        </button>
      </form>
    </div>
  );
} 