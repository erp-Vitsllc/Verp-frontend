import React, { useEffect, useState } from 'react';
import { X, Search, ChevronRight, ChevronDown, User, Network } from 'lucide-react';
import axiosInstance from '@/utils/axios';

const HierarchySelector = ({ onClose, onSelect }) => {
    const [hierarchy, setHierarchy] = useState([]);
    const [manager, setManager] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedNodes, setExpandedNodes] = useState({});

    useEffect(() => {
        const fetchHierarchy = async () => {
            try {
                const res = await axiosInstance.get('/Employee/dashboard/hierarchy');
                setHierarchy(res.data.hierarchy || []);
                setManager(res.data.manager);
                // Expand root by default
                if (res.data.manager) setExpandedNodes({ [res.data.manager._id]: true });
            } catch (error) {
                console.error("Failed to fetch hierarchy", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHierarchy();
    }, []);

    // Helper to build tree from flat list
    const buildTree = (manager, allEmployees) => {
        if (!manager) return [];

        const getChildren = (parentId, visited = new Set()) => {
            // Prevent deep recursion or cycles
            if (visited.has(parentId)) return [];

            const currentVisited = new Set(visited);
            currentVisited.add(parentId);

            return allEmployees
                .filter(e => e.primaryReportee === parentId && !currentVisited.has(e._id))
                .map(child => ({
                    ...child,
                    children: getChildren(child._id, currentVisited)
                }));
        };

        return [{
            ...manager,
            children: getChildren(manager._id, new Set())
        }];
    };

    const treeData = buildTree(manager, hierarchy);

    const toggleNode = (id) => {
        setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const renderTree = (nodes) => {
        return nodes.map(node => {
            // Filter logic
            const matchesSearch = node.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                node.lastName.toLowerCase().includes(searchTerm.toLowerCase());

            // If searching, always expand valid paths or show matches
            // Ideally, filtering a tree is complex. 
            // MVP: If search term exists, flattening locally or just highlighting might be easier.
            // For now, let's just render the tree structure regularly.

            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = expandedNodes[node._id] || searchTerm.length > 0;

            if (searchTerm && !matchesSearch && !hasChildren) return null; // Simple filter

            return (
                <div key={node._id} className="ml-4 border-l border-slate-100 pl-4 relative">
                    <div
                        className={`flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer ${matchesSearch && searchTerm ? 'bg-blue-50 ring-2 ring-blue-100' : 'hover:bg-slate-50'}`}
                        onClick={() => {
                            onSelect(node);
                            onClose();
                        }}
                    >
                        {hasChildren ? (
                            <div
                                onClick={(e) => { e.stopPropagation(); toggleNode(node._id); }}
                                className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </div>
                        ) : (
                            <div className="w-6 h-6 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                            </div>
                        )}

                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs overflow-hidden">
                            {node.profilePicture ? (
                                <img src={node.profilePicture} alt="User" className="w-full h-full object-cover" />
                            ) : (
                                node.firstName?.[0]
                            )}
                        </div>

                        <div>
                            <p className="text-sm font-bold text-slate-700">{node.firstName} {node.lastName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{node.designation || 'Employee'}</p>
                        </div>
                    </div>

                    {isExpanded && node.children && (
                        <div className="mt-1">
                            {renderTree(node.children)}
                        </div>
                    )}
                </div>
            );
        });
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-xl z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                            <Network className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900">Select Team Member</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">View requests for...</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-red-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 py-4 bg-slate-50/50">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border-0 ring-1 ring-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400 text-sm font-medium"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="-ml-4">
                            {renderTree(treeData)}
                            {hierarchy.length === 0 && (
                                <div className="text-center py-10 text-slate-400 font-medium italic">
                                    No reportees found.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HierarchySelector;
