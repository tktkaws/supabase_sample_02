'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/database.types';
import { useRouter } from 'next/navigation';

type Profile = Database['public']['Tables']['profiles']['Row'];

type GroupWithMembers = {
  id: number;
  name: string | null;
  description: string | null;
  created_at: string;
  members: {
    id: number;
    name: string | null;
    organization: string | null;
  }[];
};

export default function EditGroupPage({ params }: { params: { id: string } }) {
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    fetchGroup();
    fetchUsers();
  }, [params.id]);

  const fetchGroup = async () => {
    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        user_group_relations!inner (
          profiles!inner (
            id,
            name,
            organization
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error fetching group:', error);
      return;
    }

    const formattedGroup = {
      id: data.id,
      name: data.name,
      description: data.description,
      created_at: data.created_at,
      members: data.user_group_relations.map((relation: any) => relation.profiles)
    };

    setGroup(formattedGroup);
    setGroupName(data.name || '');
    setDescription(data.description || '');
    setSelectedUsers(data.user_group_relations.map((relation: any) => relation.profiles.id));
  };

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
      // グループを更新
      const { error: groupError } = await supabase
        .from('groups')
        .update({
          name: groupName,
          description: description,
        })
        .eq('id', params.id);

      if (groupError) throw groupError;

      // 既存のメンバー関係を削除
      const { error: deleteError } = await supabase
        .from('user_group_relations')
        .delete()
        .eq('group_id', params.id);

      if (deleteError) throw deleteError;

      // 新しいメンバー関係を追加
      const userGroupRelations = selectedUsers.map(userId => ({
        group_id: parseInt(params.id),
        user_id: userId
      }));

      const { error: relationError } = await supabase
        .from('user_group_relations')
        .insert(userGroupRelations);

      if (relationError) throw relationError;

      router.push('/groups');
    } catch (error) {
      console.error('Error updating group:', error);
      alert('グループの更新に失敗しました。');
    }
  };

  const toggleUser = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  if (!group) {
    return <div className="max-w-2xl mx-auto p-4">読み込み中...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">グループ編集</h1>
      
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

        <div className="flex space-x-4">
          <button
            type="submit"
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            更新
          </button>
          <button
            type="button"
            onClick={() => router.push('/groups')}
            className="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
} 