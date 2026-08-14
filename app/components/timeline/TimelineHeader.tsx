'use client';

import { PROPERTY_GROUPS, ALL_UNITS } from '../../config';

export default function TimelineHeader() {
    return (
        <div className="sticky-header-group border-b-2 border-gray-400 shadow-sm">
            {/* 1단: 숙소 그룹명 (블랙 볼드 font-black) */}
            <div
                className="grid divide-x divide-gray-300 bg-white"
                style={{
                    gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))`,
                    height: '36px',
                }}
            >
                <div className="sticky-corner bg-gray-200 text-gray-950 flex items-center justify-center font-black text-xs border-r border-gray-300">
                    숙소명
                </div>
                {PROPERTY_GROUPS.map((group) => (
                    <div
                        key={group.name}
                        className={`p-2 flex items-center justify-center font-black text-xs md:text-sm tracking-wide shadow-sm border-r border-gray-300 text-gray-950 ${group.themeClass}`}
                        style={{
                            gridColumn: `span ${group.units.length}`,
                            color: '#000000',
                            fontWeight: 900,
                        }}
                    >
                        🏢 {group.name}
                    </div>
                ))}
            </div>

            {/* 2단: 세부 호실명 */}
            <div
                className="grid divide-x divide-gray-300 bg-gray-50 border-t border-gray-200"
                style={{
                    gridTemplateColumns: `120px repeat(${ALL_UNITS.length}, minmax(110px, 1fr))`,
                    height: '42px',
                }}
            >
                <div className="sticky-corner bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-black border-r border-gray-300">
                    날짜 / 호실
                </div>
                {ALL_UNITS.map((col) => (
                    <div
                        key={col.key}
                        className="p-1.5 flex flex-col justify-center text-center bg-gray-50"
                    >
                        {col.subName && (
                            <span className="text-[10px] text-gray-500 font-bold">{col.subName}</span>
                        )}
                        <span className="text-xs md:text-sm text-gray-950 font-black">{col.displayName}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}