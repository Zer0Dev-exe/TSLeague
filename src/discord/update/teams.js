const {
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaComponentBuilder,
  ThumbnailBuilder,
  SectionBuilder,
  SeparatorBuilder,
  MessageFlags
} = require('discord.js');

const Division = require('../../Esquemas/Division.js');
const Team = require('../../Esquemas/Team.js');
const config = require('../../configs/league.js');

const { getTeamsSummaryEmbed } = require('../embeds/team.js');
const { getTeamStatsButton } = require('../buttons/team.js')

const maxTeams = config.division.maxTeams;

const updateTeamsEmbed = async ({ client }) => {
  const isV2 = (msg) =>
    (msg.flags & MessageFlags.IsComponentsV2) === MessageFlags.IsComponentsV2;

  const channel = await client.channels.fetch(config.channels.teams.id);
  if (!channel || !channel.isTextBased())
    throw new Error('Canal no encontrado o no es de texto.');

  const fetchedMessages = await channel.messages.fetch({ limit: 100 });
  const sortedMessages = Array.from(fetchedMessages.values()).sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp
  );
  const botMessages = sortedMessages.filter(
    (msg) => msg.author.id === client.user.id
  );

  const summaryMsg = botMessages.find((msg) => !isV2(msg));
  const divisionMsgs = botMessages.filter((msg) => isV2(msg));

  const divisions = await Division.find().sort({ tier: 1 }).exec();
  const expectedMessages = divisions.length;
  const teamsCount = await Team.countDocuments();
  const teamsInDivisionsCount = await Team.countDocuments({
    divisionId: { $ne: null }
  });

  // 🟪 Actualiza mensaje de resumen o limpia todo si no existe
  if (!summaryMsg) {
    for (const msg of botMessages) {
      await msg.delete().catch(() => {});
    }
  } else {
    await summaryMsg.edit({
      embeds: [
        getTeamsSummaryEmbed({
          divisionsCount: divisions.length,
          teamsInDivisionsCount,
          teamsCount
        })
      ]
    });
  }

  // 🔁 Si faltan mensajes por divisiones, reinicia todo
  if (divisionMsgs.length < expectedMessages) {
    for (const msg of botMessages) {
      await msg.delete().catch(() => {});
    }

    await channel.send({
      embeds: [
        getTeamsSummaryEmbed({
          divisionsCount: divisions.length,
          teamsInDivisionsCount,
          teamsCount
        })
      ]
    });

    for (const division of divisions) {
      const teams = await Team.find({ divisionId: division._id })
        .populate('members.userId')
        .sort({ name: 1 })
        .exec();

      const container = buildDivisionContainer(division, teams);
      await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    return;
  }

  // 🧩 Editar mensajes existentes por división
  for (let i = 0; i < divisions.length; i++) {
    const division = divisions[i];
    const msg = divisionMsgs[i];
    if (!msg) continue;

    const teams = await Team.find({ divisionId: division._id })
      .populate('members.userId')
      .sort({ name: 1 })
      .exec();

    const container = buildDivisionContainer(division, teams);
    await msg.edit({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  // ✂️ Eliminar mensajes sobrantes si hay extras
  if (divisionMsgs.length > expectedMessages) {
    for (let i = expectedMessages; i < divisionMsgs.length; i++) {
      await divisionMsgs[i].delete().catch(() => {});
    }
  }
};

// 🧠 Utilidad para construir el embed de una división
function buildDivisionContainer(division, teams) {
  const container = new ContainerBuilder()
    .setAccentColor(parseInt(division.color.replace('#', ''), 16))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${division.emoji || '🏆'} División ${division.name || 'Sin nombre'} — ${teams.length}/${maxTeams}`
      )
    );

  if (teams.length === 0) {
    container.addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('División sin equipos.'))
    return container
  }

  for (const team of teams) {
    const { name, iconURL, members } = team;

    const rolePriority = { 'leader': 0, 'sub-leader': 1, 'member': 2 }
      const sortedMembers = [...team.members].sort((a, b) => {
        return rolePriority[a.role] - rolePriority[b.role]
      })

      const formattedList = sortedMembers.map(m => {
        const userId = m.userId.discordId || m.userId // por si acaso no está poblado
        const roleLabel = m.role === 'leader' ? '<:leader:1395916423695564881>' :
                          m.role === 'sub-leader' ? '<:subleader:1395916298025832519>' :
                          '<:member:1395916668869283860>'
        return `${roleLabel} <@${userId}>`
      }).join('\n')

    const thumbnailComponent = new ThumbnailBuilder({ media: { url: iconURL } });

    const sectionComponent = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent([
          `### ${name}`,
          formattedList
        ].join('\n'))
      )
      .setThumbnailAccessory(thumbnailComponent)

      const sectionComponent2 = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('** **')
      )
      .setButtonAccessory(getTeamStatsButton({ i: name }))

    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addSectionComponents(sectionComponent, sectionComponent2)
  }

  return container;
}

module.exports = { updateTeamsEmbed }