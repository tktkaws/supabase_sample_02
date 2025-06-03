'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/database.types';
import Link from 'next/link';

type Group = Database['public']['Tables']['groups']['Row'];
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

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    // グループとメンバー情報を取得
    const { data: groupsData, error: groupsError } = await supabase
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
      .order('created_at', { ascending: false });

    if (groupsError) {
      console.error('Error fetching groups:', groupsError);
      return;
    }

    // データ構造を整形
    const formattedGroups = groupsData.map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      created_at: group.created_at,
      members: group.user_group_relations.map(relation => relation.profiles)
    }));

    setGroups(formattedGroups);
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">グループ一覧</h1>
        <Link
          href="/groups/new"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          新規グループ作成
        </Link>
      </div>

      <div className="grid gap-4">
        {groups.map((group) => (
          <div
            key={group.id}
            className="border rounded p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold">{group.name}</h2>
              <Link
                href={`/groups/${group.id}/edit`}
                className="text-blue-500 hover:text-blue-600"
              >
                編集
              </Link>
            </div>
            {group.description && (
              <p className="text-gray-600 mb-2">{group.description}</p>
            )}
            <div className="mb-2">
              <h3 className="text-sm font-medium text-gray-700 mb-1">メンバー:</h3>
              <div className="flex flex-wrap gap-2">
                {group.members.map((member) => (
                  <span
                    key={member.id}
                    className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-sm"
                  >
                    {member.name} ({member.organization})
                  </span>
                ))}
              </div>
            </div>
            <div className="text-sm text-gray-500">
              作成日: {new Date(group.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 