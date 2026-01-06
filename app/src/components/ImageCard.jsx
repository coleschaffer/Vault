export default function ImageCard({ image, onClick }) {
  return (
    <article
      className="bg-white border border-stone-200 rounded-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
      onClick={onClick}
    >
      {/* Image Thumbnail */}
      <div className="aspect-square overflow-hidden bg-stone-100">
        <img
          src={image.imageSrc}
          alt={image.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Card Info */}
      <div className="p-4">
        <h3 className="font-serif text-sm text-stone-900 leading-tight truncate">
          {image.title}
        </h3>
        <p className="text-xs text-stone-500 mt-1">
          by {image.creator}
        </p>

        {/* Tags Preview */}
        <div className="flex flex-wrap gap-1 mt-3">
          {image.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="px-1.5 py-0.5 text-[10px] text-stone-500 bg-stone-50 border border-stone-200 rounded-sm"
            >
              {tag}
            </span>
          ))}
          {image.tags.length > 3 && (
            <span className="px-1.5 py-0.5 text-[10px] text-stone-400">
              +{image.tags.length - 3}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
