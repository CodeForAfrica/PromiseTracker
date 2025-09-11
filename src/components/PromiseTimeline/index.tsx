"use client";

import { SxProps, Theme, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React, { useEffect, useRef, useState } from "react";

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
};

export type TimelineStatusHistoryItem = TimelineStatus & {
  date: string; // ISO date
};

type PromiseTimelineProps = {
  events?: TimelineEvent[];
  status: TimelineStatus;
  statusHistory: TimelineStatusHistoryItem[];
  sx?: SxProps<Theme>;
};

const promiseInterval: [number, number] = [2020, 2025];

const Labels = () => {
  const interval = promiseInterval;
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));

  const firstLabel = (
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
        {interval[0]}
      </text>
    </>
  );

  const lastLabel = (
    <>
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
        {interval[1]}
      </text>
    </>
  );

  let labels: React.ReactNode[] = [];
  if (isDesktop) {
    labels = Array(interval[1] - interval[0] - 1)
      .fill(0)
      .map((_, idx) => interval[0] + 1 + idx)
      .map((year, i) => (
        <React.Fragment key={year}>
          <circle
            cx={`${((i + 1) * 100) / (interval[1] - interval[0])}%`}
            cy="70"
            r="4"
            stroke="#F7F7F7"
            strokeWidth="1"
            fill="#202020"
          />
          <text
            x={`${((i + 1) * 100) / (interval[1] - interval[0])}%`}
            y="86"
            dominantBaseline="hanging"
            stroke="#202020"
            strokeWidth=".2"
            fontFamily={theme.typography.body2.fontFamily as string}
            fontSize={theme.typography.body2.fontSize as string}
          >
            {year}
          </text>
        </React.Fragment>
      ));
  }

  return (
    <>
      {firstLabel}
      {labels}
      {lastLabel}
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
}: {
  color?: string;
  isOdd?: boolean;
  radius?: number;
  rx?: number;
  textColor?: string;
  title: string;
  year: number;
}) => {
  const interval = promiseInterval;
  const theme = useTheme();
  const xposition = `${((year - interval[0]) * 100) / (interval[1] - interval[0])}%`;
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
};

const PromiseStatus = ({
  children,
  color,
  date,
  title,
  isOdd,
  rx,
  textColor,
}: PromiseStatusProps) => {
  const interval = promiseInterval;
  const d = new Date(date);
  const year = d.getFullYear() + (d.getMonth() + 1) / 12; // e.g. 2024.5
  const width = `${((year - interval[0]) * 100) / (interval[1] - interval[0])}%`;
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
      />
    </>
  );
};

const PromiseTimeline = ({
  events = [],
  status,
  statusHistory: statusHistoryProp,
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
          date: status.date ?? new Date().toISOString(),
        },
      ];

  return (
    <svg
      width="100%"
      height="100"
      style={{ overflow: "visible", ...(sx as any) }}
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
          />
        ))}
      {statusHistory?.map((currentStatus, idx) => (
        <PromiseStatus
          key={currentStatus.date}
          color={currentStatus.color}
          date={currentStatus.date}
          title={currentStatus.label ?? "STATUS"}
          isOdd={idx % 2 === 1}
        >
          {idx === 0 && (
            <rect
              x="8"
              y="69"
              width="99%"
              height="1"
              style={{ fill: "#EBEBEB" }}
            />
          )}
        </PromiseStatus>
      ))}
      <Labels />
    </svg>
  );
};

export default PromiseTimeline;
