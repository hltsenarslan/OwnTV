package com.owntv.androidtv

import android.content.ComponentName
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.tvprovider.media.tv.Channel
import androidx.tvprovider.media.tv.ChannelLogoUtils
import androidx.tvprovider.media.tv.PreviewProgram
import androidx.tvprovider.media.tv.TvContractCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.URL

class AndroidTvModule : Module() {
  private val scope = CoroutineScope(Dispatchers.IO)

  override fun definition() = ModuleDefinition {
    Name("AndroidTv")

    AsyncFunction("syncChannels") { channels: List<Map<String, String>> ->
      val context = appContext.reactContext ?: return@AsyncFunction
      
      scope.launch {
        try {
          val channelId = getOrCreateChannel(context)
          if (channelId != -1L) {
            updatePrograms(context, channelId, channels)
          }
        } catch (e: Exception) {
          e.printStackTrace()
        }
      }
    }
  }

  private fun getOrCreateChannel(context: Context): Long {
    val cursor = context.contentResolver.query(
      TvContractCompat.Channels.CONTENT_URI,
      arrayOf(TvContractCompat.Channels._ID),
      "${TvContractCompat.Channels.COLUMN_DISPLAY_NAME} = ?",
      arrayOf("OwnTV Favoriler"),
      null
    )

    if (cursor != null && cursor.moveToFirst()) {
      val id = cursor.getLong(0)
      cursor.close()
      return id
    }
    cursor?.close()

    val channel = Channel.Builder()
      .setType(TvContractCompat.Channels.TYPE_PREVIEW)
      .setDisplayName("OwnTV Favoriler")
      .setAppLinkIntentUri(Uri.parse("owntv://home"))
      .build()

    val channelUri = context.contentResolver.insert(
      TvContractCompat.Channels.CONTENT_URI,
      channel.toContentValues()
    )

    if (channelUri != null) {
      val id = ContentUris.parseId(channelUri)
      TvContractCompat.requestChannelBrowsable(context, id)
      return id
    }

    return -1L
  }

  private fun updatePrograms(context: Context, channelId: Long, channels: List<Map<String, String>>) {
    // 1. Delete old programs
    context.contentResolver.delete(
      TvContractCompat.Programs.CONTENT_URI,
      "${TvContractCompat.Programs.COLUMN_CHANNEL_ID} = ?",
      arrayOf(channelId.toString())
    )

    // 2. Add new programs
    channels.forEach { channelData ->
      val id = channelData["id"] ?: ""
      val name = channelData["name"] ?: "Unknown"
      val logo = channelData["logo"] ?: ""

      val intentUri = Uri.parse("owntv://player?id=$id")
      
      val program = PreviewProgram.Builder()
        .setChannelId(channelId)
        .setType(TvContractCompat.PreviewPrograms.TYPE_CHANNEL)
        .setTitle(name)
        .setDescription("OwnTV ile İzle")
        .setPosterArtUri(Uri.parse(logo))
        .setIntentUri(intentUri)
        .setInternalProviderId(id)
        .build()

      context.contentResolver.insert(
        TvContractCompat.PreviewPrograms.CONTENT_URI,
        program.toContentValues()
      )
    }
  }
}
