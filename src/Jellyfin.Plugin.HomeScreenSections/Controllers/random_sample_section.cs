// Add this to your existing Controllers or create a new RandomSampleController.cs

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Jellyfin.Data.Enums;
using MediaBrowser.Controller.Dto;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Querying;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.HomeSections.Controllers
{
    [ApiController]
    [Route("RandomSample")]
    [Authorize]
    public class RandomSampleController : ControllerBase
    {
        private readonly ILibraryManager _libraryManager;
        private readonly IDtoService _dtoService;
        private readonly ILogger<RandomSampleController> _logger;

        public RandomSampleController(
            ILibraryManager libraryManager,
            IDtoService dtoService,
            ILogger<RandomSampleController> logger)
        {
            _libraryManager = libraryManager;
            _dtoService = dtoService;
            _logger = logger;
        }

        /// <summary>
        /// Get available libraries for selection
        /// </summary>
        [HttpGet("Libraries")]
        public ActionResult<List<BaseItemDto>> GetAvailableLibraries()
        {
            try
            {
                var user = HttpContext.User;
                var userId = user.GetUserId();

                var libraries = _libraryManager.GetUserRootFolder()
                    .Children
                    .Where(i => i is CollectionFolder)
                    .Where(i => i.IsVisible(user))
                    .Select(i => _dtoService.GetBaseItemDto(i, new DtoOptions(), user))
                    .ToList();

                return Ok(libraries);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting available libraries");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get random sample from selected libraries
        /// </summary>
        [HttpPost("GetRandomSample")]
        public async Task<ActionResult<QueryResult<BaseItemDto>>> GetRandomSample(
            [FromBody] RandomSampleRequest request)
        {
            try
            {
                var user = HttpContext.User;
                var userId = user.GetUserId();

                if (request.LibraryIds == null || !request.LibraryIds.Any())
                {
                    return BadRequest("At least one library must be selected");
                }

                var allItems = new List<BaseItem>();

                // Get items from each selected library
                foreach (var libraryId in request.LibraryIds)
                {
                    var library = _libraryManager.GetItemById(libraryId);
                    if (library == null || !library.IsVisible(user))
                        continue;

                    var query = new InternalItemsQuery(user)
                    {
                        Parent = library,
                        Recursive = true,
                        IncludeItemTypes = GetIncludeItemTypes(request.IncludeMovies, request.IncludeTvShows, request.IncludeMusic),
                        IsVirtualItem = false,
                        Limit = 1000 // Reasonable limit per library
                    };

                    var libraryItems = _libraryManager.GetItemsResult(query).Items;
                    allItems.AddRange(libraryItems);
                }

                // Randomly sample items
                var random = new Random();
                var sampleSize = Math.Min(request.SampleSize ?? 20, allItems.Count);
                var randomItems = allItems
                    .OrderBy(x => random.Next())
                    .Take(sampleSize)
                    .ToList();

                // Convert to DTOs
                var dtoOptions = new DtoOptions()
                {
                    Fields = new[]
                    {
                        ItemFields.BasicSyncInfo,
                        ItemFields.CanDelete,
                        ItemFields.CanDownload,
                        ItemFields.PrimaryImageAspectRatio,
                        ItemFields.Overview,
                        ItemFields.Genres,
                        ItemFields.DateCreated,
                        ItemFields.MediaStreams,
                        ItemFields.People
                    }
                };

                var dtos = randomItems
                    .Select(item => _dtoService.GetBaseItemDto(item, dtoOptions, user))
                    .ToList();

                var result = new QueryResult<BaseItemDto>
                {
                    Items = dtos,
                    TotalRecordCount = dtos.Count
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting random sample");
                return StatusCode(500, "Internal server error");
            }
        }

        private string[] GetIncludeItemTypes(bool includeMovies, bool includeTvShows, bool includeMusic)
        {
            var types = new List<string>();

            if (includeMovies)
                types.Add("Movie");

            if (includeTvShows)
            {
                types.Add("Series");
                types.Add("Episode");
            }

            if (includeMusic)
            {
                types.Add("Audio");
                types.Add("MusicAlbum");
            }

            return types.Any() ? types.ToArray() : new[] { "Movie", "Series" };
        }
    }

    public class RandomSampleRequest
    {
        public Guid[] LibraryIds { get; set; } = Array.Empty<Guid>();
        public int? SampleSize { get; set; } = 20;
        public bool IncludeMovies { get; set; } = true;
        public bool IncludeTvShows { get; set; } = true;
        public bool IncludeMusic { get; set; } = false;
    }
}

// Add this to register the section automatically when the plugin starts
// Add this to your main Plugin.cs file or create a separate service

using System.Net.Http;
using System.Text;
using System.Text.Json;
using Jellyfin.Plugin.HomeSections.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.HomeSections
{
    public partial class Plugin : BasePlugin<PluginConfiguration>
    {
        // Add this method to automatically register the random sample section
        public async Task RegisterRandomSampleSection()
        {
            try
            {
                var httpClient = new HttpClient();
                var baseUrl = GetJellyfinBaseUrl(); // You'll need to implement this

                var sectionData = new
                {
                    id = "random-library-sample",
                    displayText = "Random Library Sample",
                    limit = 1,
                    additionalData = "",
                    resultsEndpoint = $"{baseUrl}/RandomSample/GetRandomSample"
                };

                var json = JsonSerializer.Serialize(sectionData);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                await httpClient.PostAsync($"{baseUrl}/HomeScreen/RegisterSection", content);
                Logger.LogInformation("Random Sample section registered successfully");
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Failed to register Random Sample section");
            }
        }

        private string GetJellyfinBaseUrl()
        {
            // You'll need to get the actual Jellyfin server URL
            // This might be available through configuration or services
            return "http://localhost:8096"; // Replace with actual implementation
        }
    }
}