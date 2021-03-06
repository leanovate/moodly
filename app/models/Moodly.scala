package models

import java.util.Date

import org.joda.time.DateTime
import play.api.db.slick.Config.driver.simple._
import java.sql.Timestamp
import tyrex.services.UUID
import play.api.libs.json.{JsNumber, JsString, JsObject, Writes}

case class Moodly(id: String, start: Timestamp, intervalDays: Int) {
  def this(intervalDays: Int) = this(UUID.create(), new Timestamp(Moodly.dateBegin().getTime), intervalDays)
  def this(intervalDays: Int, start: DateTime) = this(UUID.create(), new Timestamp(start.withTimeAtStartOfDay().toDate.getTime), intervalDays)
  def currentIterationCount(date: Date = new Date()) = ((date.getTime - start.getTime) / (intervalDays * 1000 * 60 * 60 * 24)).toInt
}

object Moodly {

  def dateBegin(): Date = DateTime.now().withTimeAtStartOfDay().toDate

  implicit object MoodlyWrites extends Writes[Moodly] {
    override def writes(moodly: Moodly) = JsObject(Seq(
      "id" -> JsString(moodly.id),
      "start" -> JsNumber(moodly.start.getTime),
      "intervalDays" -> JsNumber(moodly.intervalDays)))
  }

}

class Moodlies(tag: Tag) extends Table[Moodly](tag, "moodly") {
  def id = column[String]("id", O.PrimaryKey)

  def start = column[Timestamp]("start", O.NotNull)

  def intervalDays = column[Int]("interval_days", O.NotNull)

  def * = (id, start, intervalDays) <>((Moodly.apply _).tupled, Moodly.unapply)
}

object Moodlies {
  val moodlies = TableQuery[Moodlies]

  def findById(id: String)(implicit s: Session): Option[Moodly] = {
    moodlies.filter(_.id === id).firstOption
  }

  def insert(moodly: Moodly)(implicit s: Session) {
    moodlies.insert(moodly)
  }
}