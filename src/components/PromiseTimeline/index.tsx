"use client";

import { Box, SxProps, Theme, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React, { useEffect, useMemo, useRef, useState } from "react";

export type TimelineEvent = {
  title: string;
  year: number;
  color?: string;
  textColor?: string;
};

export type TimelineStatus = {
  color: string;
  label?: string;
  date?: string;
  textColor?: string;
};

export type TimelineStatusHistoryItem = TimelineStatus & {
  date: string; // ISO date
};

type PromiseTimelineProps = {
  events?: TimelineEvent[];
  status: TimelineStatus;
  statusHistory: TimelineStatusHistoryItem[];
  interval?: [number, number];
  sx?: SxProps<Theme>;
};

const clampInterval = (interval: [number, number]): [number, number] => {
  const [start, endInitial] = interval;
  let end = endInitial;
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear + 1];
  }

  if (end <= start) {
    end = start + 1;
  }

  return [Math.floor(start), Math.ceil(end)];
};

const buildLabelYears = (start: number, end: number): number[] => {
  const range = end - start;

  if (range <= 0) {
    return [start];
  }

  if (range <= 5) {
    return Array.from({ length: range + 1 }, (_, idx) => start + idx);
  }

  const step = range / 5;
  const raw = Array.from({ length: 6 }, (_, idx) => start + step * idx);
  const labels = raw.map((value, idx) => {
    if (idx === 0) return start;
    if (idx === raw.length - 1) return end;
    return Math.round(value);
  });

  const unique = Array.from(new Set(labels)).sort((a, b) => a - b);
  if (unique[0] !== start) {
    unique.unshift(start);
  }
  if (unique[unique.length - 1] !== end) {
    unique.push(end);
  }

  return unique;
};

const Labels = ({ interval }: { interval: [number, number] }) => {
  const [startYear, endYear] = interval;
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));

  const labelYears = useMemo(
    () => buildLabelYears(startYear, endYear),
    [startYear, endYear]
  );

  if (!isDesktop) {
    return (
      <>
        <circle
          cx="8"
          cy="70"
          r="8"
          stroke="#F7F7F7"
          strokeWidth="1"
          fill="#202020"
        />
        <text
          x="0"
          y="86"
          dominantBaseline="hanging"
          stroke="#202020"
          strokeWidth=".2"
          fontFamily={theme.typography.body2.fontFamily as string}
          fontSize={theme.typography.body2.fontSize as string}
        >
          {startYear}
        </text>
        <circle
          cx="100%"
          cy="70"
          r="8"
          stroke="#F7F7F7"
          strokeWidth="1"
          fill="#EBEBEB"
        />
        <text
          x="100%"
          y="86"
          dominantBaseline="hanging"
          stroke="#202020"
          strokeWidth=".2"
          fontFamily={theme.typography.body2.fontFamily as string}
          fontSize={theme.typography.body2.fontSize as string}
          textAnchor="end"
        >
          {endYear}
        </text>
      </>
    );
  }

  const range = endYear - startYear || 1;

  return (
    <>
      <circle
        cx="8"
        cy="70"
        r="8"
        stroke="#F7F7F7"
        strokeWidth="1"
        fill="#202020"
      />
      <text
        x="0"
        y="86"
        dominantBaseline="hanging"
        stroke="#202020"
        strokeWidth=".2"
        fontFamily={theme.typography.body2.fontFamily as string}
        fontSize={theme.typography.body2.fontSize as string}
      >
        {startYear}
      </text>
      {labelYears.slice(1, -1).map((year) => {
        const position = ((year - startYear) * 100) / range;
        return (
          <React.Fragment key={year}>
            <circle
              cx={`${position}%`}
              cy="70"
              r="4"
              stroke="#F7F7F7"
              strokeWidth="1"
              fill="#202020"
            />
            <text
              x={`${position}%`}
              y="86"
              dominantBaseline="hanging"
              stroke="#202020"
              strokeWidth=".2"
              fontFamily={theme.typography.body2.fontFamily as string}
              fontSize={theme.typography.body2.fontSize as string}
              textAnchor="middle"
            >
              {year}
            </text>
          </React.Fragment>
        );
      })}
      <circle
        cx="100%"
        cy="70"
        r="8"
        stroke="#F7F7F7"
        strokeWidth="1"
        fill="#EBEBEB"
      />
      <text
        x="100%"
        y="86"
        dominantBaseline="hanging"
        stroke="#202020"
        strokeWidth=".2"
        fontFamily={theme.typography.body2.fontFamily as string}
        fontSize={theme.typography.body2.fontSize as string}
        textAnchor="end"
      >
        {endYear}
      </text>
    </>
  );
};

const TimelineEvent = ({
  color = "#fff",
  isOdd = false,
  radius = 4,
  rx = 0,
  textColor = "#202020",
  title,
  year,
  interval,
}: {
  color?: string;
  isOdd?: boolean;
  radius?: number;
  rx?: number;
  textColor?: string;
  title: string;
  year: number;
  interval: [number, number];
}) => {
  const [startYear, endYear] = interval;
  const theme = useTheme();
  const range = endYear - startYear || 1;
  const xposition = `${((year - startYear) * 100) / range}%`;
  const yposition = isOdd ? "50" : "20";
  const textRef = useRef<SVGTextElement | null>(null);
  const [textPosition, setTextPosition] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (textRef.current) {
      setTextPosition(textRef.current.getBBox());
    }
  }, [textRef]);

  return (
    <>
      <circle
        cx={xposition}
        cy="70"
        r={radius}
        stroke="#F7F7F7"
        strokeWidth={1}
        fill={color}
      />
      <rect
        width={`${textPosition.width * 1.5}`}
        height={`${textPosition.height * 2}`}
        x={`${textPosition.x - (textPosition.width * 1.5) / 6}`}
        y={`${textPosition.y - textPosition.height / 2}`}
        fill={color}
        rx={rx}
      />
      <text
        ref={textRef}
        x={xposition}
        y={yposition}
        fill={textColor}
        stroke="#202020"
        strokeWidth={0.1}
        fontFamily={theme.typography.h6.fontFamily as string}
        fontSize={theme.typography.h6.fontSize as string}
        fontWeight={600}
        textAnchor="middle"
      >
        {title?.toUpperCase()}
      </text>
    </>
  );
};

type PromiseStatusProps = {
  children?: React.ReactNode;
  color: string;
  date: string;
  title: string;
  isOdd?: boolean;
  rx?: number;
  textColor?: string;
  interval: [number, number];
};

const PromiseStatus = ({
  children,
  color,
  date,
  title,
  isOdd,
  rx,
  textColor,
  interval,
}: PromiseStatusProps) => {
  const [startYear, endYear] = interval;
  const d = new Date(date);
  const year = d.getFullYear() + (d.getMonth() + 1) / 12; // e.g. 2024.5
  const range = endYear - startYear || 1;
  const width = `${Math.min(100, Math.max(0, ((year - startYear) * 100) / range))}%`;
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  return (
    <>
      <rect x="8" y="65" width={width} height="10" style={{ fill: color }} />
      {isDesktop && children}
      <TimelineEvent
        title={title}
        isOdd={isOdd}
        rx={rx}
        textColor={textColor}
        color={color}
        radius={8}
        year={year}
        interval={interval}
      />
    </>
  );
};

const deriveInterval = (
  intervalProp: [number, number] | undefined,
  statusHistory: TimelineStatusHistoryItem[],
  events: TimelineEvent[]
): [number, number] => {
  if (intervalProp) {
    return clampInterval(intervalProp);
  }

  const years: number[] = [];
  statusHistory.forEach((status) => {
    const year = new Date(status.date).getFullYear();
    if (!Number.isNaN(year)) {
      years.push(year);
    }
  });

  events.forEach((event) => {
    if (!Number.isNaN(event.year)) {
      years.push(Math.floor(event.year));
    }
  });

  if (!years.length) {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear + 1];
  }

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  if (minYear === maxYear) {
    return [minYear, minYear + 1];
  }

  return clampInterval([minYear, maxYear]);
};

const PromiseTimeline = ({
  events = [],
  status,
  statusHistory: statusHistoryProp,
  interval,
  sx,
}: PromiseTimelineProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const statusHistory: TimelineStatusHistoryItem[] = isDesktop
    ? statusHistoryProp
    : [
        {
          color: status.color,
          label: status.label,
          textColor: status.textColor,
          date: status.date ?? new Date().toISOString(),
        },
      ];

  const resolvedInterval = useMemo(
    () => deriveInterval(interval, statusHistoryProp, events),
    [interval, statusHistoryProp, events]
  );

  return (
    <Box
      component="svg"
      preserveAspectRatio="none"
      sx={{ width: "100%", height: 100, overflow: "visible", ...(sx || {}) }}
    >
      <rect x="8" y="69" width="99%" height="1" style={{ fill: "#EBEBEB" }} />
      {isDesktop &&
        events?.map((event) => (
          <TimelineEvent
            key={`${event.title}-${event.year}`}
            title={event.title}
            year={event.year}
            color={event.color}
            textColor={event.textColor}
            interval={resolvedInterval}
          />
        ))}
      {statusHistory?.map((currentStatus, idx) => (
        <PromiseStatus
          key={currentStatus.date}
          color={currentStatus.color}
          date={currentStatus.date}
          title={currentStatus.label ?? "STATUS"}
          isOdd={idx % 2 === 1}
          textColor={currentStatus.textColor}
          interval={resolvedInterval}
        >
          {currentStatus.label && (
            <text
              x="8"
              y={idx % 2 === 1 ? "40" : "5"}
              fill={currentStatus.textColor ?? "#202020"}
              stroke="#202020"
              strokeWidth={0.1}
              fontFamily={theme.typography.body2.fontFamily as string}
              fontSize={theme.typography.body2.fontSize as string}
              fontWeight={600}
            >
              {currentStatus.label?.toUpperCase()}
            </text>
          )}
        </PromiseStatus>
      ))}
      <Labels interval={resolvedInterval} />
    </Box>
  );
};

export default PromiseTimeline;
