#!/usr/bin/env node

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import {
    intro,
    outro,
    select,
    spinner,
    text,
    group,
    cancel,
} from "@clack/prompts";
import minimist from "minimist";
import chalk from "chalk";

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const { t, s, e } = minimist(process.argv.slice(2));

const holidays = {
    "2024-12-24": "Christmas Eve",
    "2024-12-25": "Christmas Day",
    "2024-12-26": "Proclamation Day",
    "2024-12-31": "New Year's Eve",
    "2025-01-01": "New Year's Day",
    "2025-01-27": "Australia Day",
    "2025-03-10": "Adelaide Cup Day",
    "2025-04-18": "Good Friday",
    "2025-04-19": "Easter Saturday",
    "2025-04-20": "Easter Sunday",
    "2025-04-21": "Easter Monday",
    "2025-04-25": "ANZAC Day",
    "2025-06-09": "King's Birthday",
    "2025-10-06": "Labour Day",
    "2025-12-25": "Christmas Day",
    "2025-12-26": "Proclamation Day",
    "2025-12-31": "New Year's Eve",
    "2026-01-01": "New Year's Day",
    "2026-01-26": "Australia Day",
    "2026-03-09": "Adelaide Cup Day",
    "2026-04-03": "Good Friday",
    "2026-04-04": "Easter Saturday",
    "2026-04-05": "Easter Sunday",
    "2026-04-06": "Easter Monday",
    "2026-04-25": "ANZAC Day",
    "2026-06-08": "King's Birthday",
    "2026-10-05": "Labour Day",
    "2026-12-25": "Christmas Day",
    "2026-12-26": "Proclamation Day",
    "2026-12-31": "New Year's Eve",
};

const leaveTypes = {
    44300214: "ALG-74: Annual Leave",
    44300239: "ALG-75: Personal Leave",
    44300160: "ALG-110: Unpaid Leave",
};

const holidaysArr = Object.keys(holidays).map((day) =>
    dayjs(day).format("YYYY-MM-DD")
);

const isValidDate = (dateString) => {
    return dayjs(dateString, "YYYY-MM-DD", true).isValid();
};

const isValidEndDate = (start, end) => {
    return (
        isValidDate(end) &&
        !dayjs(end).isSame(dayjs(start)) &&
        dayjs(end).isAfter(dayjs(start))
    );
};

const createTogglEntry = async (current, end, config) => {
    if (current.isAfter(end)) {
        outro("All done!");

        return;
    }

    const day = current.day();
    const formattedDay = current.format("YYYY-MM-DD");

    const s = spinner();
    s.start(`Processing ${formattedDay}`);

    const isPublicHoliday = config.holidays.includes(formattedDay);

    if (day === 0 || day === 6) {
        s.stop(`⏭️  Skipping ${formattedDay} since its the weekend`);
        return createTogglEntry(current.add(1, "day"), end, config);
    }

    const payload = {
        created_with: "toggl with wings",
        description: isPublicHoliday
            ? `ALG-78: ${holidays[formattedDay]}`
            : config.description,
        duration: 27360,
        pid: 163203548,
        wid: 2427707,
        tid: isPublicHoliday ? 44300245 : config.tid,
        start: current.set("hour", 9).set("minute", 0).utc().format(),
    };

    fetch(`https://api.track.toggl.com/api/v9/time_entries`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${config.authString}`,
        },
    })
        .then((response) => {
            if (response.status !== 200) {
                s.stop(
                    chalk.red(`Failed with status code ${response.status}!`)
                );
                return;
            }
            s.stop(
                `✅ Recorded ${formattedDay} as ${isPublicHoliday ? `ALG-78: ${holidays[formattedDay]}` : leaveTypes[config.tid]}`
            );
            return createTogglEntry(current.add(1, "day"), end, config);
        })
        .catch((e) => {
            console.log(e);
            s.stop("Failed!");
        });
};

intro(
    `
${chalk.gray("│")}   ▀█▀ █▀█ █▀▀ █▀▀ █░░
${chalk.gray("│")}   ░█░ █▄█ █▄█ █▄█ █▄▄
${chalk.gray("│")}
${chalk.gray("│")}   █░█░█ █ ▀█▀ █░█   █░█░█ █ █▄░█ █▀▀ █▀
${chalk.gray("│")}   ▀▄▀▄▀ █ ░█░ █▀█   ▀▄▀▄▀ █ █░▀█ █▄█ ▄█
${chalk.gray("│")}
${chalk.gray("│")}   helper for recording holiday entries.`
);

const instructions = await group(
    {
        api_token: () =>
            t ??
            text({
                message:
                    "What is your Toggl API key? Visit https://track.toggl.com/profile and scroll to the bottom to get the key",
                validate(value) {
                    if (value.length === 0) return `API Key is required!`;
                },
            }),

        start: () =>
            isValidDate(s)
                ? s
                : text({
                      message: "When does your holidays start? ",
                      placeholder: "YYYY-MM-DD",
                      initialValue: "2024-12-",
                      validate(value) {
                          if (!isValidDate(value))
                              return `Invalid date, needs to be in YYYY-MM-DD format.`;
                      },
                  }),

        end: ({ results }) =>
            isValidEndDate(results.start, e)
                ? e
                : text({
                      message: "When does your holidays end? ",
                      placeholder: "YYYY-MM-DD",
                      initialValue: "2025-01-",
                      validate(value) {
                          if (!isValidDate(value))
                              return `Invalid date, needs to be in YYYY-MM-DD format.`;

                          if (!isValidEndDate(results.start, value))
                              return `End date should come after start date!`;
                      },
                  }),

        leaveType: () =>
            select({
                message: "What's your leave type?",
                options: Object.entries(leaveTypes).map(([value, label]) => ({
                    label,
                    value: Number(value),
                })),
            }),

        description: ({ results }) =>
            text({
                message: "Add a description to the entries",
                initialValue: leaveTypes[results.leaveType],
                validate(value) {
                    if (value.length === 0)
                        return `Description can't be empty.`;
                },
            }),
    },
    {
        onCancel: () => {
            cancel("Cancelled.");
            process.exit(0);
        },
    }
);

await createTogglEntry(dayjs(instructions.start), dayjs(instructions.end), {
    holidays: holidaysArr,
    authString: btoa(`${instructions.api_token}:api_token`),
    description: instructions.description,
    tid: instructions.leaveType,
});
