'use client';

import { PROPERTY_GROUPS, VERTICAL_GRID_COLUMNS } from '../../config';

export default function TimelineHeader() {
    return (
        <div className="sticky-header-group border-b-2 border-gray-400 dark:border-slate-700 shadow-sm">
            {/* 1단: 숙소 그룹명 (블랙 볼드 font-black) */}
            <div
                className="grid divide-x divide-gray-300 dark:divide-slate-700 bg-white dark:bg-slate-900"
                style={{
                    gridTemplateColumns: VERTICAL_GRID_COLUMNS,
                    height: '36px',
                }}
            >
                <div className="sticky-corner bg-gray-200 dark:bg-slate-800 text-gray-950 dark:text-slate-100 flex items-center justify-center font-black text-xs border-r border-gray-300 dark:border-slate-700">
                    숙소명
                </div>
                {PROPERTY_GROUPS.map((group, idx) => (
                    <div key={`header-group-${group.name}`} className="contents">
                        <div
                            className={`p-2 flex items-center justify-center font-black text-xs md:text-sm tracking-wide shadow-sm ${group.themeClass}`}
                            style={{
                                gridColumn: `span ${group.units.length}`,
                                fontWeight: 900,
                            }}
                        >
                            🏢 {group.name}
                        </div>
                        {idx < PROPERTY_GROUPS.length - 1 && (
                            <div className="property-divider-pillar" />
                        )}
                    </div>
                ))}
            </div>

            {/* 2단: 세부 호실명 */}
            <div
                className="grid divide-x divide-gray-300 dark:divide-slate-700 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700"
                style={{
                    gridTemplateColumns: VERTICAL_GRID_COLUMNS,
                    height: '42px',
                }}
            >
                <div className="sticky-corner bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 flex items-center justify-center text-xs font-black border-r border-gray-300 dark:border-slate-700">
                    날짜 / 호실
                </div>
                {PROPERTY_GROUPS.map((group, idx) => (
                    <div key={`header-units-${group.name}`} className="contents">
                        {group.units.map((col) => (
                            <div
                                key={col.key}
                                className="p-1.5 flex flex-col justify-center text-center bg-gray-50 dark:bg-slate-900"
                            >
                                {col.subName && (
                                    <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">{col.subName}</span>
                                )}
                                <span className="text-xs md:text-sm text-gray-950 dark:text-slate-100 font-black">{col.displayName}</span>
                            </div>
                        ))}
                        {idx < PROPERTY_GROUPS.length - 1 && (
                            <div className="property-divider-pillar" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}